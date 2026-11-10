// One-off infrastructure for a self-hosted BDI game on Azure.
// Deploy it into an empty resource group; see docs/deployment.md.

targetScope = 'resourceGroup'

@description('Region for all resources. Defaults to the region of the resource group.')
param location string = resourceGroup().location

@description('Region for the PostgreSQL server when enablePostgres is true. Set it when your subscription may not create PostgreSQL servers in `location`.')
param postgresLocation string = location

@description('Prefix for resource names: lowercase letters and digits only.')
@minLength(3)
@maxLength(12)
param namePrefix string = 'bdigames'

@description('GitHub repository that is allowed to deploy, written as <owner>/<repo>.')
param githubRepository string

@description('Branch whose pushes are allowed to deploy.')
param githubBranch string = 'main'

@description('Image tag to run. Leave empty only for the very first deployment, before the pipeline has pushed an image; use `latest` when you deploy this template again.')
param imageTag string = ''

@description('Create an Azure Database for PostgreSQL Flexible Server and store sessions there. Off by default: sessions live only in memory and are lost on restart or deploy. Turn on when you need sessions to survive those.')
param enablePostgres bool = false

@description('Administrator login of the PostgreSQL server. Only used when enablePostgres is true.')
param postgresAdminLogin string = 'bdiadmin'

@description('Administrator password of the PostgreSQL server. Required (min 16 characters) when enablePostgres is true; leave empty otherwise.')
@secure()
param postgresAdminPassword string = ''

@description('Signs the identity tokens of browsers. Changing it signs everybody out.')
@secure()
@minLength(32)
param authSecret string

@description('Protects the internal tick endpoint.')
@secure()
@minLength(32)
param internalTickSecret string

@description('Optional custom hostname for documentation in the outputs (for example game.example.org). Attach the domain in the Azure portal; see docs/deployment.md. This parameter does not change Azure resources by itself.')
param customDomain string = ''

var token = uniqueString(resourceGroup().id)
var imageRepository = 'bdi-games'
var databaseName = 'bdi'
var appPort = 8080
// Runs until the pipeline pushes the first real image. It does not answer on appPort, so the app stays unhealthy until then.
var placeholderImage = 'mcr.microsoft.com/k8se/quickstart:latest'
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var contributorRoleId = 'b24988ac-6180-42a0-ab88-20f7382dd24c'
var databaseUrl = enablePostgres
  ? 'postgresql://${postgresAdminLogin}:${uriComponent(postgresAdminPassword)}@${postgres!.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=verify-full'
  : ''

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${namePrefix}${token}'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

// The Container App pulls images with this identity; no registry password exists.
resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-pull'
  location: location
}

resource pullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, pullIdentity.id, acrPullRoleId)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: pullIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// GitHub Actions signs in as this identity through OIDC; no client secret exists.
resource deployIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-deploy'
  location: location
}

resource githubTrust 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deployIdentity
  name: 'github-actions'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepository}:ref:refs/heads/${githubBranch}'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

// Contributor on this resource group only: push images and update the Container App.
resource deployRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, deployIdentity.id, contributorRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', contributorRoleId)
    principalId: deployIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = if (enablePostgres) {
  name: '${namePrefix}-pg-${token}'
  location: postgresLocation
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = if (enablePostgres) {
  parent: postgres
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// 0.0.0.0 is Azure's notation for "connections that originate inside Azure". The server
// still requires TLS and the administrator password.
resource allowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = if (enablePostgres) {
  parent: postgres
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
  // The server handles one child operation at a time.
  dependsOn: [
    database
  ]
}

var baseSecrets = [
  {
    name: 'auth-secret'
    value: authSecret
  }
  {
    name: 'internal-tick-secret'
    value: internalTickSecret
  }
]

var postgresSecret = [
  {
    name: 'database-url'
    value: databaseUrl
  }
]

var baseEnv = [
  {
    name: 'NODE_ENV'
    value: 'production'
  }
  {
    name: 'ALLOW_DEV_AUTH'
    value: 'true'
  }
  {
    name: 'AUTH_SECRET'
    secretRef: 'auth-secret'
  }
  {
    name: 'INTERNAL_TICK_SECRET'
    secretRef: 'internal-tick-secret'
  }
]

var postgresEnv = [
  {
    name: 'DATABASE_URL'
    secretRef: 'database-url'
  }
]

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: namePrefix
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${pullIdentity.id}': {}
    }
  }
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: appPort
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: registry.properties.loginServer
          identity: pullIdentity.id
        }
      ]
      secrets: concat(baseSecrets, enablePostgres ? postgresSecret : [])
    }
    template: {
      containers: [
        {
          name: 'game'
          image: empty(imageTag) ? placeholderImage : '${registry.properties.loginServer}/${imageRepository}:${imageTag}'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: concat(baseEnv, enablePostgres ? postgresEnv : [])
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/health'
                port: appPort
              }
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 10
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: appPort
              }
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: appPort
              }
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      // Sessions live in the memory of one process. Never raise maxReplicas.
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
  dependsOn: enablePostgres ? [
    pullRole
    database!
    allowAzureServices!
  ] : [
    pullRole
  ]
}

// The names below match the GitHub Actions variables that .github/workflows/deploy.yml reads.
output AZURE_CLIENT_ID string = deployIdentity.properties.clientId
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_SUBSCRIPTION_ID string = subscription().subscriptionId
output AZURE_RESOURCE_GROUP string = resourceGroup().name
output AZURE_CONTAINER_REGISTRY string = registry.name
output AZURE_CONTAINER_APP string = app.name
output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output enablePostgres bool = enablePostgres
output customDomainHint string = customDomain

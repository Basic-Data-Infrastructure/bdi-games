import { GameError } from './types.js'
import type { GameCatalogEntry, GameDefinition } from './game-definition.js'
import { catalogEntry } from './game-definition.js'
import { LOGISTICS_GAME_ID, logisticsGame } from './games/logistics/definition.js'
import { ACCESS_GAME_ID, accessGame } from './games/access/definition.js'

const GAMES: GameDefinition[] = [logisticsGame, accessGame]

export const DEFAULT_GAME_ID = LOGISTICS_GAME_ID

export function listGames(): GameCatalogEntry[] {
  return GAMES.map(catalogEntry)
}

export function getGame(id: string | null | undefined): GameDefinition {
  const key = id && id.length > 0 ? id : DEFAULT_GAME_ID
  const game = GAMES.find((item) => item.id === key)
  if (!game) throw new GameError('unknown_game', `Onbekend spel: ${key}.`, 404)
  return game
}

export function normalizeGameId(id: string | null | undefined): string {
  return getGame(id).id
}

export { ACCESS_GAME_ID, LOGISTICS_GAME_ID }

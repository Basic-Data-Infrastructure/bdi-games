import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { Bootstrap, Home, Host, Join, Play, Settings, TestTable } from './screens'
import './styles.css'

const router = createHashRouter([
  { path: '/', element: <Home /> },
  { path: '/settings', element: <Settings /> },
  { path: '/host/:sessionId', element: <Host /> },
  { path: '/join', element: <Join /> },
  { path: '/play/:sessionId', element: <Play /> },
  { path: '/table/:sessionId?', element: <TestTable /> },
  { path: '/bootstrap', element: <Bootstrap /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

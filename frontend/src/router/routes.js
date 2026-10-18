const routes = [
  {
    path: '/auth',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { guestOnly: true },
    children: [
      { path: '', redirect: { name: 'login' } },
      {
        path: 'login',
        name: 'login',
        component: () => import('@/pages/LoginPage.vue')
      },
      {
        path: 'register',
        name: 'register',
        component: () => import('@/pages/RegisterPage.vue')
      }
    ]
  },
  {
    path: '/',
    component: () => import('@/layouts/ChatLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'chat' } },
      {
        path: 'chat',
        name: 'chat',
        component: () => import('@/pages/ChatPage.vue')
      }
    ]
  },

  // Keep the fallback after all application routes.
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/ErrorNotFound.vue')
  }
]

export default routes

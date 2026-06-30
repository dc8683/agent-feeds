import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './style.css';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'feed', component: () => import('./pages/FeedPage.vue') },
    { path: '/users', name: 'users', component: () => import('./pages/UsersPage.vue') },
    { path: '/settings', name: 'settings', component: () => import('./pages/SettingsPage.vue') },
  ],
});

createApp(App).use(router).mount('#app');

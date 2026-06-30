<template>
  <div>
    <div class="page-header">博主管理</div>
    <PlatformTabs
      v-model="users.activePlatform.value"
      :statuses="users.platformStatuses.value"
    />

    <!-- Subscribed users by group -->
    <div class="section-title">已订阅 · Feed 中</div>
    <UserGroupList
      :users="subscribedUsers"
      :groups="users.groups.value"
      @toggle="users.toggleUser"
      @set-group="users.setUserGroup"
    />

    <!-- Platform follow list -->
    <div class="section-title">平台关注列表</div>
    <div style="padding: 12px; color: var(--color-text-muted); font-size: 13px;">
      连接平台后可拉取关注列表
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useUsers } from '../composables/useUsers';
import PlatformTabs from '../components/PlatformTabs.vue';
import UserGroupList from '../components/UserGroupList.vue';

const users = useUsers();

const subscribedUsers = computed(() =>
  users.users.value.filter(u => u.enabled)
);

onMounted(() => {
  users.loadUsers();
  users.loadGroups();
});
</script>

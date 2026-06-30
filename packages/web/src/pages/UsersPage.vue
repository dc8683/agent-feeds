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

    <!-- Add blogger by URL (小红书) or from follow list -->
    <div class="section-title">添加博主</div>
    <div class="card" style="margin: 8px 12px;">
      <div v-if="users.activePlatform.value === 'xiaohongshu'" style="padding: 4px 0;">
        <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 10px;">
          粘贴小红书博主主页链接
        </p>
        <div style="display: flex; gap: 8px;">
          <input
            v-model="profileUrl"
            type="text"
            placeholder="https://www.xiaohongshu.com/user/profile/..."
            style="flex: 1; font-size: 13px;"
            @keyup.enter="addByUrl"
          />
          <button class="btn btn-primary btn-sm" @click="addByUrl" :disabled="adding">
            {{ adding ? '添加中...' : '添加' }}
          </button>
        </div>
        <p v-if="addError" style="color: var(--color-red); font-size: 12px; margin-top: 8px;">{{ addError }}</p>
        <p v-if="addSuccess" style="color: var(--color-green); font-size: 12px; margin-top: 8px;">{{ addSuccess }}</p>
      </div>
      <div v-else style="padding: 4px 0; color: var(--color-text-muted); font-size: 13px;">
        连接平台后可拉取关注列表添加
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useUsers } from '../composables/useUsers';
import PlatformTabs from '../components/PlatformTabs.vue';
import UserGroupList from '../components/UserGroupList.vue';
import { apiPost } from '../api/client';

const users = useUsers();
const profileUrl = ref('');
const adding = ref(false);
const addError = ref('');
const addSuccess = ref('');

const subscribedUsers = computed(() =>
  users.users.value.filter(u => u.enabled)
);

async function addByUrl() {
  const url = profileUrl.value.trim();
  if (!url) return;

  // Basic validation
  if (!url.includes('xiaohongshu.com/user/profile/')) {
    addError.value = '请输入小红书博主主页链接';
    return;
  }

  adding.value = true;
  addError.value = '';
  addSuccess.value = '';

  try {
    await apiPost('/users/add-by-url', { url });
    addSuccess.value = '添加成功，正在拉取内容...';
    profileUrl.value = '';
    await users.loadUsers();
  } catch (err: any) {
    addError.value = err.message || '添加失败';
  } finally {
    adding.value = false;
  }
}

onMounted(() => {
  users.loadUsers();
  users.loadGroups();
});
</script>

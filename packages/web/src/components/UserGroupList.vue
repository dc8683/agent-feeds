<template>
  <div v-if="groupedUsers.length === 0" style="padding: 12px 16px; color: var(--color-text-muted); font-size: 13px;">
    暂无订阅，从下方平台关注列表中添加
  </div>

  <div v-for="group in groupedUsers" :key="group.id ?? '__unassigned'" class="group-section">
    <div class="card">
      <div class="group-header">
        <span :style="{ color: group.color || '#6366f1' }">{{ group.name }} · {{ group.users.length }}人</span>
        <span style="font-size: 12px; color: var(--color-text-muted);">▼</span>
      </div>
      <div v-for="user in group.users" :key="user.id" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; font-size: 13px;">
        <span>
          <span :class="['status-dot', user.enabled ? 'green' : 'red']"></span>
          @{{ user.profile.nickname }}
        </span>
        <button class="btn btn-ghost btn-sm" @click="$emit('fetch-user', user.id)">🔄</button>
        <button class="btn btn-ghost btn-sm" @click="$emit('toggle', user.id, !user.enabled)">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FollowedUser, UserGroup } from '@agent-feeds/shared';

const props = defineProps<{
  users: FollowedUser[];
  groups: UserGroup[];
}>();

defineEmits(['toggle', 'set-group', 'fetch-user']);

const groupedUsers = computed(() => {
  const map = new Map<string | null, FollowedUser[]>();

  // Unassigned group
  map.set(null, []);

  for (const g of props.groups) {
    map.set(g.id, []);
  }

  for (const u of props.users) {
    const key = u.groupId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(u);
  }

  const result: { id: string | null; name: string; color: string; users: FollowedUser[] }[] = [];

  // Named groups first
  for (const g of props.groups) {
    result.push({ id: g.id, name: g.name, color: g.color, users: map.get(g.id) || [] });
  }

  // Unassigned
  const unassigned = map.get(null) || [];
  if (unassigned.length > 0) {
    result.push({ id: null, name: '未分组', color: '#999', users: unassigned });
  }

  return result;
});
</script>

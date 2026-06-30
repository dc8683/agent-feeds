import { ref } from 'vue';
import type { FollowedUser, UserGroup, PlatformStatus } from '@agent-feeds/shared';
import { apiGet, apiPatch } from '../api/client';

export function useUsers() {
  const users = ref<FollowedUser[]>([]);
  const groups = ref<UserGroup[]>([]);
  const activePlatform = ref('xiaohongshu');
  const platformStatuses = ref<PlatformStatus[]>([
    { platform: 'xiaohongshu', status: 'disconnected', message: '等待连接' },
    { platform: 'bilibili', status: 'disconnected', message: '等待连接' },
    { platform: 'douyin', status: 'disconnected', message: '等待连接' },
  ]);

  async function loadUsers() {
    const res = await apiGet<{ users: FollowedUser[] }>(`/users?platform=${activePlatform.value}`);
    users.value = res.users;
  }

  async function loadGroups() {
    const res = await apiGet<{ groups: UserGroup[] }>('/groups');
    groups.value = res.groups;
  }

  async function toggleUser(id: string, enabled: boolean) {
    await apiPatch(`/users/${id}`, { enabled });
    await loadUsers();
  }

  async function setUserGroup(id: string, groupId: string | null) {
    await apiPatch(`/users/${id}`, { groupId });
    await loadUsers();
  }

  async function removeUser(id: string) {
    await apiGet<{ ok: boolean }>(`/users/${id}`); // DELETE not exposed yet, use PATCH disable
    await toggleUser(id, false);
  }

  return { users, groups, activePlatform, platformStatuses, loadUsers, loadGroups, toggleUser, setUserGroup, removeUser };
}

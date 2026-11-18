import type { RecordModel } from 'pocketbase';
import { pb } from './client.ts';

export const auth = $state({
	token: pb.authStore.token,
	record: pb.authStore.record,
	isValid: pb.authStore.isValid,
	isSuperuser: pb.authStore.isSuperuser
});

pb.authStore.onChange((token, record) => {
	auth.token = token;
	auth.record = record;
	auth.isValid = pb.authStore.isValid;
	auth.isSuperuser = pb.authStore.isSuperuser;
}, true);

export async function login(email: string, password: string) {
	return pb.collection('users').authWithPassword(email, password);
}

export function logout() {
	pb.authStore.clear();
}

export function avatarUrl(record: RecordModel | null): string | undefined {
	if (!record?.avatar) return undefined;
	return pb.files.getURL(record, record.avatar);
}

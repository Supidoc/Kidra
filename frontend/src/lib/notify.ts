import { toast } from 'svelte-sonner';

/** Shows toast notifications. Needs `<Toaster />` in the root layout. */
export const notify = {
	error(message: string, title = 'Error') {
		toast.error(title, { description: message });
	},
	warning(message: string, title = 'Warning') {
		toast.warning(title, { description: message });
	},
	success(message: string, title = 'Success') {
		toast.success(title, { description: message });
	}
};

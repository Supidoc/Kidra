<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { FieldGroup, Field, FieldLabel } from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { goto } from '$app/navigation';
	import { login } from '#lib/data/auth.svelte.ts';
	import { errorMessage } from '#lib/data/errors.ts';
	const id = $props.id();

	let email = $state('');
	let password = $state('');
	let error = $state('');

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';

		try {
			await login(email, password);
			await goto('/app/master-data');
		} catch (err) {
			error = errorMessage(err);
		}
	}
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Login</Card.Title>
		<Card.Description>Enter your email below to login to your account</Card.Description>
	</Card.Header>
	<Card.Content>
		<form onsubmit={handleSubmit}>
			<FieldGroup>
				<Field>
					<FieldLabel for="email-{id}">Email</FieldLabel>
					<Input
						bind:value={email}
						id="email-{id}"
						type="email"
						placeholder="m@example.com"
						required
					/>
				</Field>
				<Field>
					<div class="flex items-center">
						<FieldLabel for="password-{id}">Password</FieldLabel>
						<!-- <a href="##" class="ms-auto inline-block text-sm underline"> Forgot your password? </a> -->
					</div>
					<Input bind:value={password} id="password-{id}" type="password" required />
				</Field>
				{#if error}
					<p class="text-sm text-destructive">{error}</p>
				{/if}
				<Field>
					<Button type="submit" class="w-full">Login</Button>
					<!-- <FieldDescription class="text-center">
            Don't have an account? <a href="##">Sign up</a>
          </FieldDescription> -->
				</Field>
			</FieldGroup>
		</form>
	</Card.Content>
</Card.Root>

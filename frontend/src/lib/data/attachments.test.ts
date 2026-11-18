import { describe, expect, it, vi } from 'vitest';

vi.mock('./client.ts', () => ({ pb: {} }));

const {
	attachmentFormData,
	downloadFileName,
	fileExtension,
	guessAttachmentKind,
	nameWithoutExtension,
	previewKind
} = await import('./attachments.ts');

describe('fileExtension', () => {
	it('returns the lower-case extension of a name or URL', () => {
		expect(fileExtension('Sheet.PDF')).toBe('pdf');
		expect(fileExtension('https://example.com/a/b.step?x=1#y')).toBe('step');
		expect(fileExtension('part.kicad_mod')).toBe('kicad_mod');
	});

	it('returns an empty string without an extension', () => {
		expect(fileExtension('README')).toBe('');
		expect(fileExtension('.hidden')).toBe('');
		expect(fileExtension('https://example.com/dir.v2/file')).toBe('');
	});
});

describe('previewKind', () => {
	it.each([
		['sheet.pdf', 'pdf'],
		['photo.JPG', 'image'],
		['logo.svg', 'image'],
		['notes.txt', 'text'],
		['model.csv', 'text'],
		['archive.zip', 'none']
	])('detects %s as %s by extension', (name, kind) => {
		expect(previewKind(name)).toBe(kind);
	});

	it.each(['step', 'stp', 'iges', 'igs', 'wrl', 'vrml', 'stl', 'glb', 'gltf', 'obj', '3mf'])(
		'treats .%s as a 3D model',
		(extension) => {
			expect(previewKind(`model.${extension}`)).toBe('3d');
		}
	);

	it('falls back to the MIME type without a known extension', () => {
		expect(previewKind('download', 'application/pdf')).toBe('pdf');
		expect(previewKind('download', 'image/png')).toBe('image');
		expect(previewKind('download', 'text/plain; charset=utf-8')).toBe('text');
		expect(previewKind('download', 'model/stl')).toBe('3d');
		expect(previewKind('download', 'application/octet-stream')).toBe('none');
		expect(previewKind('download')).toBe('none');
	});

	it('prefers the extension over a generic MIME type', () => {
		expect(previewKind('board.step', 'application/octet-stream')).toBe('3d');
	});
});

describe('guessAttachmentKind', () => {
	it('makes the first PDF the datasheet and later ones "other"', () => {
		expect(guessAttachmentKind('a.pdf', 'application/pdf', false)).toBe('datasheet');
		expect(guessAttachmentKind('b.pdf', 'application/pdf', true)).toBe('other');
	});

	it('recognises 3D models and images', () => {
		expect(guessAttachmentKind('c.step', '', false)).toBe('3d-model');
		expect(guessAttachmentKind('d.png', 'image/png', false)).toBe('image');
		expect(guessAttachmentKind('e.zip', '', false)).toBe('other');
	});
});

describe('nameWithoutExtension', () => {
	it('strips the last extension only', () => {
		expect(nameWithoutExtension('sheet.v2.pdf')).toBe('sheet.v2');
		expect(nameWithoutExtension('README')).toBe('README');
		expect(nameWithoutExtension('.env')).toBe('.env');
	});
});

describe('downloadFileName', () => {
	it('uses the decoded last path segment', () => {
		expect(downloadFileName('https://example.com/docs/my%20sheet.pdf?x=1', 'application/pdf')).toBe(
			'my sheet.pdf'
		);
	});

	it('adds an extension from the MIME type when the name has none', () => {
		expect(downloadFileName('https://example.com/lit/ds/abc', 'image/png')).toBe('abc.png');
		expect(downloadFileName('https://example.com/lit/ds/abc', 'application/x-unknown')).toBe('abc');
	});

	it('always names a datasheet .pdf', () => {
		expect(downloadFileName('https://example.com/lit/ds/abc', '', 'datasheet')).toBe('abc.pdf');
		expect(downloadFileName('https://example.com/', '', 'datasheet')).toBe('datasheet.pdf');
		expect(downloadFileName('https://example.com/a.PDF', '', 'datasheet')).toBe('a.PDF');
	});

	it('falls back to a generic name', () => {
		expect(downloadFileName('https://example.com/', 'model/stl')).toBe('download.stl');
	});
});

describe('attachmentFormData', () => {
	it('sends trimmed metadata and the file', () => {
		const file = new File(['x'], 'model.step');
		const body = attachmentFormData({
			id: 'new-1',
			name: ' Model ',
			url: ' ',
			kind: '3d-model',
			description: ' Rev A ',
			file
		});
		expect(body.get('name')).toBe('Model');
		expect(body.get('url')).toBe('');
		expect(body.get('kind')).toBe('3d-model');
		expect(body.get('description')).toBe('Rev A');
		expect(body.get('file')).toBeInstanceOf(File);
		expect(body.has('id')).toBe(false);
	});
});

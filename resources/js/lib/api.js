const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

async function request(method, url, body, options = {}) {
    const headers = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-TOKEN': csrf(),
        ...(options.headers ?? {}),
    };

    let payload = body;

    if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }

    const response = await fetch(url, {
        method,
        headers,
        credentials: 'same-origin',
        body: payload,
    });

    if (response.status === 204) {
        return { success: true, data: null };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        if (response.ok) {
            return { success: true, data: await response.text() };
        }

        throw new ApiError('Terjadi kesalahan pada server.', response.status, null);
    }

    const json = await response.json();

    if (!response.ok || json.success === false) {
        throw new ApiError(json.message ?? 'Permintaan gagal.', response.status, json);
    }

    return json;
}

export class ApiError extends Error {
    constructor(message, status, payload) {
        super(message);
        this.status = status;
        this.payload = payload;
        // Laravel mengirim error validasi per field pada `errors`.
        this.details = payload?.details ?? payload?.errors ?? null;
    }
}

export const api = {
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, body ?? {}),
    put: (url, body) => request('PUT', url, body ?? {}),
    patch: (url, body) => request('PATCH', url, body ?? {}),
    delete: (url) => request('DELETE', url),
    upload: (url, formData) => request('POST', url, formData),
};

export async function download(url, filename) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: '*/*' },
    });

    if (!response.ok) {
        throw new ApiError('Berkas tidak dapat diunduh.', response.status, null);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
}

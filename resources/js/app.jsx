import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { ConfirmProvider, ToastProvider } from './Components/UI';
import { createRoot } from 'react-dom/client';

createInertiaApp({
    title: (title) => (title ? `${title} — SADAR DIRI` : 'SADAR DIRI'),
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.jsx', { eager: true });
        const page = pages[`./Pages/${name}.jsx`];

        if (!page) {
            throw new Error(`Halaman tidak ditemukan: ${name}`);
        }

        return page;
    },
    setup({ el, App, props }) {
        createRoot(el).render(
            <ToastProvider>
                <ConfirmProvider>
                    <App {...props} />
                </ConfirmProvider>
            </ToastProvider>,
        );
    },
    progress: {
        color: '#3f51b5',
    },
});

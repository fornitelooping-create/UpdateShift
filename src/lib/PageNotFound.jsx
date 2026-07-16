import { db } from '@/lib/localDb';

import { useLocation, Link } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

export default function PageNotFound({}) {
    const location = useLocation();
    const pageName = location.pathname.substring(1);

    const { data: authData, isFetched } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const user = await db.auth.me();
                return { user, isAuthenticated: true };
            } catch (error) {
                return { user: null, isAuthenticated: false };
            }
        }
    });

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
            <div className="max-w-md w-full">
                <div className="text-center space-y-6">
                    {/* 404 Error Code */}
                    <div className="space-y-2">
                        <h1 className="text-7xl font-light text-slate-300">404</h1>
                        <h2 className="text-xl font-semibold text-slate-800">Page introuvable</h2>
                        <p className="text-sm text-slate-500">
                            {pageName ? (
                                <>La page <span className="font-mono text-slate-700">/{pageName}</span> n'existe pas.</>
                            ) : (
                                <>Cette page n'existe pas.</>
                            )}
                        </p>
                    </div>

                    <Link
                        to="/"
                        className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition"
                    >
                        Retour à l'accueil
                    </Link>
                </div>
            </div>
        </div>
    );
}

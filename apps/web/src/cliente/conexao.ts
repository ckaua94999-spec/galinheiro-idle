import { create } from 'zustand';

interface EstadoConexao { online: boolean }

export const useConexao = create<EstadoConexao>(() => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
}));

export const marcarOnline = (): void => {
  if (!useConexao.getState().online) useConexao.setState({ online: true });
};
export const marcarOffline = (): void => {
  if (useConexao.getState().online) useConexao.setState({ online: false });
};

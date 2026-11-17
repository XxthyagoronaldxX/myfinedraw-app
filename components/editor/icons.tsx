/* Ícones de traço fino no mesmo estilo (stroke 1.6, cantos arredondados). */
const S = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props} />
);

export const Terminal = () => <S><rect x="3" y="7" width="18" height="10" rx="5" /></S>;
export const Process = () => <S><rect x="3.5" y="6" width="17" height="12" rx="1.5" /></S>;
export const Decision = () => <S><path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" /></S>;
export const Io = () => <S><path d="M7 6h14l-4 12H3Z" /></S>;
export const Doc = () => <S><path d="M4 5h16v11c-3-2-5 2-8 1.5S7 15 4 17Z" /></S>;
export const Sub = () => <S><rect x="3" y="6" width="18" height="12" rx="1.5" /><path d="M7 6v12M17 6v12" /></S>;
export const Text = () => <S><path d="M5 6h14M12 6v13M9 19h6" /></S>;
export const Table = () => (
  <S>
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <path d="M3.5 9h17M3.5 14.5h17M9 9v11" />
  </S>
);
export const Sticky = () => <S><path d="M5 4h14v10l-6 6H5Z" /><path d="M13 20v-6h6" /></S>;
export const Code = () => (
  <S>
    <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
  </S>
);
export const Markdown = () => (
  <S>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
    <path d="M6 15V9l2.5 3L11 9v6M15.5 9v6M13.5 13l2 2 2-2" />
  </S>
);
export const Image = () => (
  <S>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m20.5 16-5-5-8.5 8.5" />
  </S>
);
export const Undo = () => <S><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></S>;
export const Redo = () => <S><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></S>;
export const Grid = () => <S><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></S>;
export const Db = () => (
  <S width={16} height={16}>
    <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
    <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
  </S>
);
export const EdgeStep = () => <S width={15} height={15}><path d="M4 19V12h16V5" /></S>;
export const EdgeStraight = () => <S width={15} height={15}><path d="M4 20 20 4" /></S>;
export const EdgeCurve = () => <S width={15} height={15}><path d="M4 20C4 10 20 14 20 4" /></S>;
export const Sidebar = ({ open }: { open: boolean }) => (
  <S>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M9 4v16" />
    {open ? <path d="m15.5 10-2 2 2 2" /> : <path d="m13 10 2 2-2 2" />}
  </S>
);
export const Magnet = () => (
  <S>
    <path d="M6 3v8a6 6 0 0 0 12 0V3" />
    <path d="M6 7h4M14 7h4" />
    <path d="M10 3v8a2 2 0 0 0 4 0V3" />
  </S>
);
export const Actor = () => (
  <S>
    <circle cx="12" cy="5" r="2.6" />
    <path d="M12 7.6V14M6.5 10h11M12 14l-4 6.5M12 14l4 6.5" />
  </S>
);
export const UseCase = () => <S><ellipse cx="12" cy="12" rx="9.5" ry="5.5" /></S>;
export const Plus = () =><S width={16} height={16}><path d="M12 5v14M5 12h14" /></S>;

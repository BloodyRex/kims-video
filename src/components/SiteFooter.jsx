import { Link, useLocation } from "react-router-dom";
import { useLocale } from "../i18n";

/* 站点统一页脚：固定 6 个入口，当前页 aria-current="page" + cyan 高亮 */
const FOOTER_LINKS = [
  { id: "home", key: "footer.home", to: "/?search=1" },
  { id: "discover", key: "footer.discover", to: "/discover" },
  { id: "intel", key: "footer.intel", to: "/intelligence" },
  { id: "festivals", key: "footer.festivals", to: "/festivals" },
  { id: "wall", key: "footer.wall", to: "/wall" },
  { id: "mydata", key: "footer.mydata", to: "/my-data" },
];

function isActive(to, pathname) {
  if (to === "/?search=1") {
    return pathname === "/" || pathname.startsWith("/?");
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

const BASE =
  "flex items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 border-2 border-black shadow-[3px_3px_0_0_#000] bg-white text-black font-bold text-xs sm:text-sm uppercase tracking-wider transition-colors hover:bg-[#ff00ff] hover:text-white";

export default function SiteFooter({ locale } = {}) {
  const { t, locale: ctxLocale } = useLocale();
  const loc = locale || ctxLocale;
  const { pathname } = useLocation();
  const zh = loc === "zh";

  return (
    <footer
      className={`fixed bottom-0 left-0 w-full z-20 flex flex-wrap justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 border-t-4 border-[#ffff00] bg-black ${zh ? "text-sm max-sm:text-xs" : "pixel-font text-[10px] max-sm:text-[9px] uppercase tracking-widest"}`}
    >
      {FOOTER_LINKS.map((link) => {
        const active = isActive(link.to, pathname);
        return (
          <Link
            key={link.id}
            to={link.to}
            aria-current={active ? "page" : undefined}
            className={`${BASE} ${active ? "text-cyan-400 font-black" : ""}`}
          >
            {t(link.key)}
          </Link>
        );
      })}
    </footer>
  );
}

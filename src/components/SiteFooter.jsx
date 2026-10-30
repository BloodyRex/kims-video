import { Fragment } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useLocale } from "../i18n";

/* 站点统一页脚：固定 6 个入口，当前页 aria-current="page" + cyan 高亮 */
const FOOTER_LINKS = [
  { id: "home", key: "footer.home", to: "/search" },
  { id: "discover", key: "footer.discover", to: "/discover" },
  { id: "intel", key: "footer.intel", to: "/intelligence" },
  { id: "festivals", key: "footer.festivals", to: "/festivals" },
  { id: "wall", key: "footer.wall", to: "/wall" },
];

function isActive(link, pathname, searchParams, activeId) {
  if (activeId) return link.id === activeId;
  // 「AI 推荐」指向独立路由 /search；首页 splash 为 /
  if (link.id === "home") {
    return pathname === "/search";
  }
  return pathname === link.to || pathname.startsWith(`${link.to}/`);
}

export default function SiteFooter({ locale, activeId } = {}) {
  const { t, locale: ctxLocale } = useLocale();
  const loc = locale || ctxLocale;
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const zh = loc === "zh";

  return (
    <footer
      className={`fixed bottom-0 left-0 w-full z-20 flex flex-nowrap items-center justify-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 border-t-4 border-[#ffff00] bg-black overflow-x-auto ${zh ? "text-xs sm:text-sm" : "pixel-font text-[9px] sm:text-[10px] uppercase tracking-normal sm:tracking-widest"}`}
    >
      {FOOTER_LINKS.map((link, i) => {
        const active = isActive(link, pathname, searchParams, activeId);
        return (
          <Fragment key={link.id}>
            <Link
              to={link.to}
              aria-current={active ? "page" : undefined}
              className={`transition-colors whitespace-nowrap flex-shrink-0 leading-none py-1 font-black ${active ? "text-[#00ffff]" : "text-white hover:text-[#ffff00]"}`}
            >
              {t(link.key)}
            </Link>
            {i < FOOTER_LINKS.length - 1 && (
              <span className="text-gray-600 mx-1 sm:mx-2 leading-none font-black">|</span>
            )}
          </Fragment>
        );
      })}
      <span className="text-gray-800 mx-1">·</span>
      <Link
        to="/admin"
        className="text-[8px] opacity-20 hover:opacity-100 hover:text-[#ffff00] transition-colors"
        aria-label="Admin"
      >
        ·
      </Link>
    </footer>
  );
}

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

export default function SiteFooter({ locale } = {}) {
  const { t, locale: ctxLocale } = useLocale();
  const loc = locale || ctxLocale;
  const { pathname } = useLocation();
  const zh = loc === "zh";

  return (
    <footer
      className={`fixed bottom-0 left-0 w-full z-20 flex flex-wrap justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 border-t-4 border-[#ffff00] bg-black ${zh ? "text-sm max-sm:text-xs" : "pixel-font text-[10px] max-sm:text-[9px] uppercase tracking-widest"}`}
    >
      {FOOTER_LINKS.map((link, i) => {
        const active = isActive(link.to, pathname);
        return (
          <React.Fragment key={link.id}>
            <Link
              to={link.to}
              aria-current={active ? "page" : undefined}
              className={`transition-colors ${active ? "text-[#00ffff] font-black" : "hover:text-[#ffff00]"}`}
            >
              {t(link.key)}
            </Link>
            {i < FOOTER_LINKS.length - 1 && <span className="text-gray-600 mx-2">|</span>}
          </React.Fragment>
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

import React from "react";

export const Icons = {
  Film: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M17 3v18" />
      <path d="M3 7.5h4" />
      <path d="M3 12h18" />
      <path d="M3 16.5h4" />
      <path d="M17 7.5h4" />
      <path d="M17 16.5h4" />
    </svg>
  ),
  Search: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  ChevronRight: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
  Play: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  ),
  Loader2: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} animate-spin`}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
  RefreshCw: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  ),
  Star: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  MessageCircle: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Target: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  Share2: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  Info: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
  Tv: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="15" x="2" y="7" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  ),

  Music: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),

  Calendar: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  ),

  Trending: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),

  FileText: ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  ),

  Spotify: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#1DB954" className={className}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.68 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  ),

  Imdb: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#F5C518" className={className}>
      <path d="M13.6 10.2c-.2-.2-.5-.3-.9-.3h-.9v4.7h.8c.4 0 .7-.1.9-.3.2-.2.3-.5.3-1v-2c0-.5-.1-.8-.2-1.1zM5.6 10.8h1.4v3.8H5.6zM20.4 4H3.6C2.2 4 1.1 5.1 1.1 6.5v11c0 1.4 1.1 2.5 2.5 2.5h16.8c1.4 0 2.5-1.1 2.5-2.5v-11c0-1.4-1.1-2.5-2.5-2.5zM9 14.7H7.4v-3.9H5.6V9.7H9v5zm2.8 0H9.9V9.7h1.9c.7 0 1.2.2 1.6.5.4.4.6.9.6 1.6v1.8c0 .7-.2 1.2-.6 1.6-.4.3-.9.5-1.7.5zm4.5-.1c0 .5-.1.9-.3 1.2-.2.3-.5.5-.9.6-.4.1-.8.2-1.4.2h-2V9.7h2c.5 0 1 .1 1.4.2.4.1.7.3.9.6.2.3.3.7.3 1.2v2.9zm3.9-2.4h-1.3v1.6h1.2v1.2H18v-3.9h2.9c0 .4-.1.7-.2.9-.1.1-.2.2-.4.2z"/>
    </svg>
  ),
  Bilibili: () => (
    <img src="/bilibili-logo.png" alt="Bilibili" width="14" height="14" />
  ),
  Youtube: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  AppleMusic: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF" className={className}>
      <path d="M17.04 0c.045 4.027-2.39 6.305-4.117 7.092-.216.097-.398.02-.478-.156-.294-.646-.924-2.037-.277-3.815.502-1.374 3.192-3.694 4.872-3.12zM19.182 7.117c.776.943 1.738 1.678 2.837 2.242a.291.291 0 0 1 .128.365c-.298.81-1.21 2.316-2.418 2.316a1.54 1.54 0 0 1-.507-.094c-.603-.222-1.127-.415-2.014-.415-.924 0-1.46.198-2.077.414-.55.193-1.12.393-1.884.393-.666 0-1.294-.22-1.87-.655-.565-.427-.92-1.059-1.105-1.817-.19-.76-.2-1.594.183-2.445.83-1.848 2.7-2.818 4.638-2.818.802 0 1.47.196 2.118.384.633.184 1.243.362 1.976.362.645 0 1.213-.195 1.894-.42.08-.025.155-.033.225-.033.058 0 .113.006.164.018zM16.124 17.06c-.45.585-.844 1.096-1.656 1.096-.805 0-1.11-.468-2.111-.468-1.02 0-1.381.463-2.12.463-.722 0-1.21-.457-1.705-1.08C7.4 16.073 6.8 14.25 6.8 12.56c0-2.088 1.322-3.204 2.644-3.204.717 0 1.315.385 1.835.385.503 0 1.097-.404 1.921-.404.75 0 1.442.293 1.958.816.582.337 1.23.902 1.484 1.648a.155.155 0 0 1-.067.176c-.322.2-.6.398-.838.654-.53.568-.843 1.285-.843 2.17 0 .852.306 1.563.826 2.16.2.23.44.437.704.619.1.07.113.224.002.3a2.446 2.446 0 0 0-.245.18z"/>
    </svg>
  ),
  NeteaseCloudMusic: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#C20C0C" className={className}>
      <path d="M13.08 2.074c-4.9.12-5.52 3.92-5.48 6.3v.02c-.8-.22-1.66-.34-2.54-.34-1.98 0-3.84.84-5.1 2.42-.06.08-.04.2.04.26.06.04.14.04.2 0 1.18-1.52 2.98-2.32 4.84-2.32.84 0 1.66.12 2.4.38 0 1.12 0 1.32.02 3.04v6.384c0 .008.004.036.004.064l.006.13c0 1.38-.26 2.38-1.12 3.22.04.06.08.14.12.2 1.4-1.02 2.24-2.56 2.24-4.34l-.024-8.054c0-1.68.56-3.44 2.48-4.3 1.94-.86 4.26-.68 5.94.4 1.6 1.04 2.52 2.82 2.5 4.84-.02 2.36-1.5 4.48-3.7 5.28-.42.14-.86.22-1.28.22-.2 0-.4-.02-.58-.06-.3-.06-.58-.18-.84-.34-.4-.26-.72-.6-.96-1.02-.26-.48-.42-1.12-.24-1.78.08-.32.18-.62.32-.9.24-.48.56-.86.94-1.16.38-.3.8-.52 1.26-.66.44-.14.92-.2 1.4-.18.74.02 1.48.24 2.14.64.68.42 1.24 1.02 1.62 1.8.02.06.1.08.16.06.04-.02.06-.06.06-.1-.02-.72-.24-1.42-.66-2.04-.42-.62-1.02-1.12-1.72-1.46-.7-.34-1.48-.52-2.28-.52-1.08 0-2.16.26-3.16.8a5.954 5.954 0 0 0-2.28 2.3c-.54.96-.8 2.06-.76 3.14.04 1.88.76 3.52 2.04 4.6 1.26 1.08 2.92 1.68 4.74 1.68 1.82 0 3.54-.56 5.02-1.62 1.48-1.06 2.56-2.52 3.2-4.16.64-1.66.84-3.4.58-5.06-.24-1.64-.92-3.16-1.96-4.42-1.06-1.28-2.38-2.24-3.94-2.84-1.54-.6-3.18-.82-4.82-.62zM5.32 10.376c.54 0 1.06.12 1.52.32v.04c0 .02.02.04.02.06l.02 4.62c.02.02.02.04.02.06v1.82c-.02.04-.02.08-.02.12 0 1.24-.5 2.16-1.32 2.88-.04.04-.08.06-.12.1a2.88 2.88 0 0 1-1.42.78c-.02 0-.04.02-.06.02-.22.06-.46.08-.68.08-.5 0-1-.14-1.44-.42-.42-.28-.76-.66-1-1.12-.26-.5-.4-1.08-.38-1.72v-.02c0-.28.04-.56.12-.82.06-.2.14-.4.24-.58.16-.28.36-.52.6-.74.24-.2.52-.36.8-.48.12-.04.24-.08.38-.1.22-.04.44-.06.66-.06.56 0 1.08.12 1.54.34 0 .02.02.04.02.06v-4.9c0-.02.02-.04.02-.06v-.04c.02-.34.1-.66.22-.96.14-.34.32-.64.56-.9.22-.24.48-.44.76-.58.02 0 .04-.02.06-.02.2-.1.42-.16.64-.2.16-.02.32-.04.48-.04z"/>
    </svg>
  ),
};

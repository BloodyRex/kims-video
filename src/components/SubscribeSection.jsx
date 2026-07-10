import React, { useState } from "react";
import { useLocale } from "../i18n";

export default function SubscribeSection({ locale }) {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");
  const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "" : "https://api.bloodyrex.xyz";

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setStatus("error");
      setMessage(locale === "en" ? "Please enter a valid email." : "请输入有效的邮箱地址。");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/intelligence/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(locale === "en" ? "Subscribed! Check your email to confirm." : "订阅成功！请查收确认邮件。");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || (locale === "en" ? "Subscription failed. Try again." : "订阅失败，请重试。"));
      }
    } catch {
      setStatus("error");
      setMessage(locale === "en" ? "Network error. Please try again." : "网络错误，请稍后重试。");
    }
  };

  return (
    <div className="border-t-4 border-[#ffff00] mt-8 pt-6 pb-20 max-sm:pb-24">
      <div className="max-w-xl mx-auto px-4">
        <h3 className="text-sm font-black text-white pixel-font uppercase tracking-wider mb-1 text-center">
          📬 {locale === "en" ? "Daily Digest" : "每日摘要订阅"}
        </h3>
        <p className="text-[10px] text-gray-500 mb-4 text-center pixel-font">
          {locale === "en"
            ? "Get the latest intelligence delivered to your inbox every day."
            : "每天将最新的影音情报推送到你的邮箱。"}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
            placeholder={locale === "en" ? "your@email.com" : "your@email.com"}
            className="flex-1 bg-white border-4 border-black px-4 py-2.5 text-sm text-black font-bold focus:outline-none focus:bg-[#ffff00] transition-colors"
            disabled={status === "loading"}
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="px-6 py-2.5 bg-[#ff00ff] hover:bg-[#ff40ff] text-white border-4 border-black font-black uppercase tracking-wider text-sm pixel-font shadow-[4px_4px_0_0_#000] hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "loading"
              ? (locale === "en" ? "..." : "提交中...")
              : (locale === "en" ? "SUBSCRIBE" : "订阅")}
          </button>
        </form>

        {message && (
          <p className={`text-center text-[10px] mt-2 pixel-font font-bold ${status === "success" ? "text-[#00ff00]" : "text-red-500"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

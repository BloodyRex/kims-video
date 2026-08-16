#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Test: qwen3.5:9b local translation quality vs TMDB official zh overview.
Uses real pipeline data (movies.json / tv.json summaryEn + summary pairs).
"""
import json, urllib.request, sys

OLLAMA = "http://localhost:11434/api/chat"
MODEL = "qwen3.5:9b"

def local_translate(text):
    prompt = (
        "你是专业的影视简介翻译。将下面的英文影视简介翻译成简体中文。"
        "要求：1) 准确、通顺、符合中文表达习惯；2) 片名、人名、地名等专有名词保留常用中文译名，"
        "没有通用译名的保留英文；3) 只输出译文，不要任何解释或前后缀。\n\n"
        f"英文原文：\n{text}"
    )
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.3, "num_ctx": 8192},
    }).encode()
    req = urllib.request.Request(OLLAMA, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.loads(r.read())
    return data["message"]["content"].strip()

def load_pairs():
    pairs = []
    for f in ["public/api/movies.json", "public/api/tv.json"]:
        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        for key in data:
            arr = data[key]
            if not isinstance(arr, list):
                continue
            for it in arr:
                en = (it.get("summaryEn") or "").strip()
                zh = (it.get("summary") or "").strip()
                if len(en) > 100 and len(zh) > 20:
                    pairs.append((it.get("title") or it.get("titleEn") or "?", en, zh))
    # dedupe by en
    seen, out = set(), []
    for p in pairs:
        if p[1] not in seen:
            seen.add(p[1])
            out.append(p)
    return out

def main():
    pairs = load_pairs()
    print(f"可用样本: {len(pairs)} 条, 取前 12 条测试\n")
    results = []
    for i, (title, en, zh_official) in enumerate(pairs[:12]):
        print(f"──── [{i+1}/12] {title} ────")
        print(f"【英文原文】{en[:150]}{'…' if len(en)>150 else ''}")
        try:
            zh_local = local_translate(en[:900])
            results.append((title, en, zh_official, zh_local))
            print(f"【qwen3.5:9b】{zh_local[:150]}{'…' if len(zh_local)>150 else ''}")
            print(f"【TMDB官方】{zh_official[:150]}{'…' if len(zh_official)>150 else ''}")
        except Exception as e:
            print(f"【调用失败】{e}")
        print()
    # quick length stats
    lens = [(r[3], len(r[3])) for r in results]
    print("完成:", len(results), "条 | 平均译文长度:", sum(l for _, l in lens) // max(len(lens), 1), "字")

if __name__ == "__main__":
    main()

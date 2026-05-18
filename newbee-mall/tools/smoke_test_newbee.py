# -*- coding: utf-8 -*-
import re
from dataclasses import dataclass

import requests


BASE = "http://localhost:28089"


@dataclass
class Check:
    name: str
    passed: bool
    detail: str


def title(html: str) -> str:
    m = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def check_page(session, path, expected_status=200, must_contain=None):
    try:
        r = session.get(BASE + path, allow_redirects=False, timeout=10)
        ok = r.status_code == expected_status
        if must_contain is not None:
            ok = ok and must_contain in r.text
        info = f"{r.status_code}"
        if "Location" in r.headers:
            info += f" -> {r.headers['Location']}"
        if r.headers.get("content-type", "").startswith("text/html"):
            info += f" title={title(r.text)}"
        return ok, info
    except Exception as exc:
        return False, f"ERROR {exc}"


def main():
    s = requests.Session()
    checks = []

    pages = [
        ("首页可打开且中文分类正常", "/", 200, "家电 数码 手机"),
        ("搜索页可打开且能搜索手机", "/search?keyword=手机", 200, "手机"),
        ("登录页可打开", "/login", 200, "登录"),
        ("注册页可打开", "/register", 200, "注册"),
        ("后台登录页可打开", "/admin/login", 200, "Log in"),
    ]
    for name, path, status, text in pages:
        ok, info = check_page(s, path, status, text)
        checks.append(Check(name, ok, info))

    protected = [
        ("商品详情未登录会跳登录", "/goods/detail/10894"),
        ("购物车未登录会跳登录", "/shop-cart"),
        ("订单列表未登录会跳登录", "/orders"),
        ("个人中心未登录会跳登录", "/personal"),
        ("后台首页未登录会跳后台登录", "/admin/index"),
    ]
    for name, path in protected:
        try:
            r = s.get(BASE + path, allow_redirects=False, timeout=10)
            loc = r.headers.get("Location", "")
            ok = r.status_code in (302, 303) and ("login" in loc)
            checks.append(Check(name, ok, f"{r.status_code} -> {loc}"))
        except Exception as exc:
            checks.append(Check(name, False, f"ERROR {exc}"))

    for name, path in [
        ("商城验证码图片可返回", "/common/mall/kaptcha"),
        ("后台验证码图片可返回", "/common/kaptcha"),
        ("本地轮播图1可返回", "/mall/image/swiper/banner01.jpg"),
        ("本地轮播图2可返回", "/mall/image/swiper/banner02.jpg"),
        ("商品图片可返回", "/goods-img/87446ec4-e534-4b49-9f7d-9bea34665284.jpg"),
    ]:
        try:
            r = s.get(BASE + path, timeout=10)
            ctype = r.headers.get("content-type", "")
            ok = r.status_code == 200 and ("image" in ctype or path.endswith(".jpg"))
            checks.append(Check(name, ok, f"{r.status_code} {ctype} bytes={len(r.content)}"))
        except Exception as exc:
            checks.append(Check(name, False, f"ERROR {exc}"))

    form_cases = [
        ("前台登录空字段返回失败JSON", "/login", {"loginName": "", "password": "", "verifyCode": ""}, "请输入登录名"),
        ("前台注册空字段返回失败JSON", "/register", {"loginName": "", "password": "", "verifyCode": ""}, "请输入登录名"),
    ]
    for name, path, data, expected in form_cases:
        try:
            r = s.post(BASE + path, data=data, timeout=10)
            ok = r.status_code == 200 and expected in r.text
            checks.append(Check(name, ok, f"{r.status_code} body={r.text[:120]}"))
        except Exception as exc:
            checks.append(Check(name, False, f"ERROR {exc}"))

    passed = sum(c.passed for c in checks)
    for c in checks:
        mark = "PASS" if c.passed else "FAIL"
        print(f"{mark}\t{c.name}\t{c.detail}")
    print(f"SUMMARY\t{passed}/{len(checks)} passed")


if __name__ == "__main__":
    main()

// Vercel Serverless Function
// 카카오 Place 내부 API를 프록시하여 영업시간 + 메뉴 데이터 반환
export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const response = await fetch(`https://place.map.kakao.com/main/v/${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://map.kakao.com/',
        'Accept': 'application/json, text/plain, */*',
      },
    });

    if (!response.ok) {
      return res.json({ hours: null, menus: [] });
    }

    const data = await response.json();

    // ── 영업시간 파싱 ──
    let hours = null;
    try {
      const periodList = data?.basicInfo?.openHour?.periodList;
      if (periodList?.length > 0) {
        const parts = periodList.map(p => {
          const day = p.periodName?.통합 || p.periodName?.요일 || '';
          const times = (p.timeList || []).map(t => t.timeSE).join(', ');
          return day ? `${day} ${times}` : times;
        }).filter(Boolean);
        if (parts.length > 0) hours = parts.join(' / ');
      }
      // 정기 휴무 추가
      const offdays = data?.basicInfo?.openHour?.offdayList;
      if (offdays?.length > 0) {
        const off = offdays.map(d => d.holidayName || d.offday).filter(Boolean).join(', ');
        if (off) hours = (hours ? hours + ' · ' : '') + `휴무: ${off}`;
      }
    } catch (e) {}

    // ── 메뉴 파싱 ──
    let menus = [];
    try {
      const menuList = data?.menuInfo?.menuList;
      if (menuList?.length > 0) {
        menus = menuList.slice(0, 6).map(m => ({
          name: m.menu || m.menuName || '',
          price: m.price || '가격 미정',
          img: m.img || m.menuImage || null,
          desc: m.desc || '',
        })).filter(m => m.name);
      }
    } catch (e) {}

    // 1시간 캐싱
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.json({ hours, menus });
  } catch (e) {
    res.json({ hours: null, menus: [] });
  }
}

/**
 * ============================================================================
 * [UPDATE HISTORY]
 * - 2026-11-20: Created standalone JavaScript module for B2B unit price multipliers,
 *               Win-Win recommended prices, reverse margin calculation, Coupang
 *               search launcher, and automatic #app DOM rendering.
 * - 2026-11-20: Full standalone browser version without partial snippets.
 * ============================================================================
 */

// [구역 1] 숫자 파싱 및 통화 포맷 유틸리티
function parseNumber(val) {
  try {
    if (typeof val === "number") {
      return Number.isFinite(val) ? Math.round(val) : 0;
    }
    const cleaned = String(val || "").replace(/[^0-9-]/g, "");
    const parsed = parseInt(cleaned, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  } catch (err) {
    console.error("[parseNumber 오류]", err);
    return 0;
  }
}

function formatKRW(num, withUnit = true) {
  try {
    const safeNum = Math.round(Number(num) || 0);
    const formatted = safeNum.toLocaleString("ko-KR");
    return withUnit ? `${formatted}원` : formatted;
  } catch (err) {
    console.error("[formatKRW 오류]", err);
    return withUnit ? "0원" : "0";
  }
}

function applyPriceRounding(amount, rule = "100_round") {
  try {
    const value = Number(amount) || 0;
    switch (rule) {
      case "10_round":
        return Math.round(value / 10) * 10;
      case "10_floor":
        return Math.floor(value / 10) * 10;
      case "100_round":
        return Math.round(value / 100) * 100;
      case "100_floor":
        return Math.floor(value / 100) * 100;
      case "1000_round":
        return Math.round(value / 1000) * 1000;
      case "1":
      default:
        return Math.round(value);
    }
  } catch (err) {
    console.error("[applyPriceRounding 오류]", err);
    return Math.round(amount) || 0;
  }
}

// [구역 2] 원가 기준 배율 계산 및 추천 단가 산출
function calculateMultiplierRow(pureCost, multiplier, roundingRule = "100_round") {
  try {
    const cost = Math.max(0, parseNumber(pureCost));
    const mult = Number(multiplier) || 1;
    const supplyPrice = applyPriceRounding(cost * mult, roundingRule);
    const vatPrice = Math.round(supplyPrice * 1.1);
    const netProfit = supplyPrice - cost;
    const marginRate = supplyPrice > 0 ? Number(((netProfit / supplyPrice) * 100).toFixed(1)) : 0;
    const markupRate = cost > 0 ? Number(((netProfit / cost) * 100).toFixed(1)) : 0;

    return {
      multiplier: Number(mult.toFixed(2)),
      supplyPrice,
      vatPrice,
      netProfit,
      marginRate,
      markupRate
    };
  } catch (err) {
    console.error("[calculateMultiplierRow 오류]", err);
    return {
      multiplier: 1,
      supplyPrice: 0,
      vatPrice: 0,
      netProfit: 0,
      marginRate: 0,
      markupRate: 0
    };
  }
}

function generateMultiplierTable(pureCost, options = {}) {
  try {
    const maxMultiplier = Number(options.maxMultiplier) || 2.0;
    const step = Number(options.step) || 0.1;
    const roundingRule = options.roundingRule || "100_round";
    const customMultiplier = options.customMultiplier ? Number(options.customMultiplier) : null;

    const customRow =
      customMultiplier && customMultiplier > 0
        ? calculateMultiplierRow(pureCost, customMultiplier, roundingRule)
        : null;

    const rows = [];
    for (let m = 1.1; m <= maxMultiplier + 0.0001; m += step) {
      const fixedMult = Math.round(m * 100) / 100;
      rows.push(calculateMultiplierRow(pureCost, fixedMult, roundingRule));
    }

    const recommendations = {
      competitive: calculateMultiplierRow(pureCost, 1.2, roundingRule),
      winWinStandard: calculateMultiplierRow(pureCost, 1.35, roundingRule),
      smallLotBuffer: calculateMultiplierRow(pureCost, 1.5, roundingRule)
    };

    return {
      pureCost: parseNumber(pureCost),
      customRow,
      rows,
      recommendations
    };
  } catch (err) {
    console.error("[generateMultiplierTable 오류]", err);
    return { pureCost: 0, customRow: null, rows: [], recommendations: {} };
  }
}

// [구역 3] 단가 & 원가 역산 계산기 (몇 배인지, 수익 % 계산)
function calculateReverseMargin(sellingPrice, pureCost, quantity = 1) {
  try {
    const sell = Math.max(0, parseNumber(sellingPrice));
    const cost = Math.max(0, parseNumber(pureCost));
    const qty = Math.max(1, parseNumber(quantity));

    const multiplier = cost > 0 ? Number((sell / cost).toFixed(2)) : 0;
    const unitProfit = sell - cost;
    const profitMarginPercent = sell > 0 ? Number(((unitProfit / sell) * 100).toFixed(1)) : 0;
    const profitOnCostPercent = cost > 0 ? Number(((unitProfit / cost) * 100).toFixed(1)) : 0;

    const totalSupply = sell * qty;
    const totalVatPrice = Math.round(sell * 1.1) * qty;
    const totalProfit = unitProfit * qty;

    let statusCode = "WIN_WIN";
    let statusLabel = "Win-Win 적정 납품 구간";
    if (unitProfit < 0) {
      statusCode = "DEFICIT";
      statusLabel = "손실 발생 (적자 구간)";
    } else if (multiplier < 1.2) {
      statusCode = "LOW_MARGIN";
      statusLabel = "소모품·경쟁 단가 구간";
    } else if (multiplier > 1.45) {
      statusCode = "HIGH_MARGIN";
      statusLabel = "고수익·소량 납품 구간";
    }

    return {
      sellingPrice: sell,
      pureCost: cost,
      quantity: qty,
      multiplier,
      unitProfit,
      profitMarginPercent,
      profitOnCostPercent,
      totalSupply,
      totalVatPrice,
      totalProfit,
      statusCode,
      statusLabel
    };
  } catch (err) {
    console.error("[calculateReverseMargin 오류]", err);
    return {
      sellingPrice: 0,
      pureCost: 0,
      quantity: 1,
      multiplier: 0,
      unitProfit: 0,
      profitMarginPercent: 0,
      profitOnCostPercent: 0,
      totalSupply: 0,
      totalVatPrice: 0,
      totalProfit: 0,
      statusCode: "ERROR",
      statusLabel: "계산 오류"
    };
  }
}

// [구역 4] 쿠팡 검색 링크 생성 및 클립보드 복사 유틸리티
function openCoupangSearchUrl(keyword) {
  try {
    const trimmed = String(keyword || "").trim();
    if (!trimmed) return "";
    const url = `https://www.coupang.com/np/search?component=&q=${encodeURIComponent(trimmed)}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return url;
  } catch (err) {
    console.error("[openCoupangSearchUrl 오류]", err);
    return "";
  }
}

function copyToClipboardSafe(text) {
  try {
    const content = String(text || "");
    if (!content) return false;

    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) return true;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content).catch(() => {});
      return true;
    }
    return false;
  } catch (err) {
    console.error("[copyToClipboardSafe 오류]", err);
    return false;
  }
}

// [구역 5] #app DOM 자동 렌더링 및 전체 이벤트 바인딩
function mountPriceCalculatorUI(targetSelector = "#app") {
  try {
    if (typeof document === "undefined") return;
    const container = document.querySelector(targetSelector);
    if (!container) {
      console.warn(`[mountPriceCalculatorUI] '${targetSelector}' 요소를 찾을 수 없습니다.`);
      return;
    }

    let recentKeywords = [];

    container.innerHTML = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; min-height: 100vh; padding: 24px; box-sizing: border-box;">
        <div style="max-width: 1580px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">

          <!-- 상단 헤더 및 쿠팡 검색 창 바로 열기 -->
          <div style="background: #0f172a; color: #ffffff; border-radius: 16px; padding: 20px 24px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px;">
            <div>
              <div style="font-size: 20px; font-weight: 800; white-space: nowrap;">B2B 납품 단가 · 마진율 빠른 계산기</div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; white-space: nowrap;">원가 대비 배수(1.1~2.0배) 즉시 계산 · 단가 자체 배송비 녹임 적용 · 캡처 붙여넣기(Cmd/Ctrl+V) 지원</div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <input id="jsCoupangKeyword" type="text" placeholder="쿠팡 검색 물품명 (예: 물밀대, 안전화)" style="padding: 10px 14px; border-radius: 10px; border: 1px solid #334155; background: #1e293b; color: #ffffff; font-size: 13px; min-width: 220px; outline: none;" />
              <button id="jsOpenCoupangBtn" type="button" style="padding: 10px 16px; border-radius: 10px; border: none; background: #e11d48; color: #ffffff; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;">
                쿠팡 검색 창 열기 ↗
              </button>
              <button id="jsResetAllBtn" type="button" style="padding: 10px 14px; border-radius: 10px; border: 1px solid #475569; background: #1e293b; color: #e2e8f0; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;">
                전체 초기화
              </button>
              <span id="jsCopyNotice" style="font-size: 12px; font-weight: 700; color: #34d399; margin-left: 6px; white-space: nowrap;"></span>
            </div>
          </div>

          <!-- 최근 쿠팡 검색 기록 -->
          <div id="jsRecentKeywordsWrap" style="display: none; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 16px; align-items: center; flex-wrap: wrap; gap: 8px;">
            <span style="font-size: 12px; font-weight: 700; color: #64748b; white-space: nowrap;">최근 검색:</span>
            <div id="jsRecentKeywordsList" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
          </div>

          <!-- 좌우 2단 분할 레이아웃 -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(440px, 1fr)); gap: 20px; align-items: start;">

            <!-- 좌측: 원가 기준 추천 단가 및 배수표 -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 18px;">
              <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px;">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                  <img id="jsSelectedThumb" src="" alt="캡처 미리보기" style="display: none; width: 44px; height: 44px; border-radius: 8px; object-fit: contain; border: 1px solid #e2e8f0; background: #f8fafc;" />
                  <div style="min-width: 0;">
                    <div id="jsSelectedLabel" style="font-size: 16px; font-weight: 800; white-space: nowrap;">1. 매입원가 기준 배수표 (1.1배 ~ 2.0배)</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px; white-space: nowrap;">상품 사진 캡처 후 Cmd/Ctrl+V를 누르면 왼쪽에 미리보기가 표시됩니다.</div>
                  </div>
                </div>
                <select id="jsRoundingRule" style="padding: 7px 10px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 12px; font-weight: 700; color: #1e293b; white-space: nowrap;">
                  <option value="1">1원 단위</option>
                  <option value="10_round">10원 반올림</option>
                  <option value="100_round" selected>100원 반올림</option>
                  <option value="1000_round">1,000원 반올림</option>
                </select>
              </div>

              <!-- 원가 입력 + 지정 배율 입력 + 빠른 증액 -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; align-items: end;">
                  <div>
                    <label for="jsPureCostInput" style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; white-space: nowrap;">순수 매입원가 (VAT 별도, 원)</label>
                    <input id="jsPureCostInput" type="text" value="10,000" style="width: 100%; box-sizing: border-box; padding: 10px 14px; border-radius: 10px; border: 2px solid #2563eb; background: #ffffff; font-size: 20px; font-weight: 800; color: #0f172a; outline: none;" />
                  </div>
                  <div>
                    <label for="jsCustomMultInput" style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; white-space: nowrap;">지정 배율 빠른 확인</label>
                    <input id="jsCustomMultInput" type="number" step="0.05" value="1.25" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: #ffffff; font-size: 18px; font-weight: 800; color: #4338ca; outline: none;" />
                  </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                  <button type="button" data-add-cost="1000" style="padding: 5px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;">+1천</button>
                  <button type="button" data-add-cost="5000" style="padding: 5px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;">+5천</button>
                  <button type="button" data-add-cost="10000" style="padding: 5px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;">+1만</button>
                  <button type="button" data-add-cost="100000" style="padding: 5px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;">+10만</button>
                  <button type="button" id="jsResetCostBtn" style="padding: 5px 10px; border-radius: 6px; border: 1px solid #fecdd3; background: #fff1f2; color: #e11d48; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;">초기화</button>
                </div>
              </div>

              <!-- Win-Win 추천 단가 3종 -->
              <div id="jsRecommendedCards" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;"></div>

              <!-- 1.1 ~ 2.0 배수 테이블 -->
              <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                  <thead>
                    <tr style="background: #f1f5f9; color: #475569; border-bottom: 1px solid #e2e8f0;">
                      <th style="padding: 10px 12px; white-space: nowrap;">배율</th>
                      <th style="padding: 10px 12px; white-space: nowrap;">공급가(VAT별도)</th>
                      <th style="padding: 10px 12px; white-space: nowrap;">VAT포함</th>
                      <th style="padding: 10px 12px; white-space: nowrap;">개당 순이익</th>
                      <th style="padding: 10px 12px; white-space: nowrap;">마진율(%)</th>
                      <th style="padding: 10px 12px; text-align: right; white-space: nowrap;">복사</th>
                    </tr>
                  </thead>
                  <tbody id="jsMultiplierTbody"></tbody>
                </table>
              </div>
            </div>

            <!-- 우측: 단가 & 원가 역산 계산기 -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 18px;">
              <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px;">
                <div style="font-size: 16px; font-weight: 800; white-space: nowrap;">2. 단가·원가 역산 계산기 (몇 배 / 수익 %)</div>
                <button id="jsSyncCostBtn" type="button" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #c7d2fe; background: #eef2ff; color: #4338ca; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;">
                  ← 좌측 원가 불러오기
                </button>
              </div>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 12px;">
                <div>
                  <label for="jsRevSellInput" style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; white-space: nowrap;">제시 / 납품 단가 (VAT 별도, 원)</label>
                  <input id="jsRevSellInput" type="text" value="13,500" style="width: 100%; box-sizing: border-box; padding: 10px 14px; border-radius: 10px; border: 2px solid #4f46e5; background: #ffffff; font-size: 20px; font-weight: 800; color: #3730a3; outline: none;" />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div>
                    <label for="jsRevCostInput" style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; white-space: nowrap;">매입 원가 (원)</label>
                    <input id="jsRevCostInput" type="text" value="10,000" style="width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: #ffffff; font-size: 15px; font-weight: 700; color: #0f172a; outline: none;" />
                  </div>
                  <div>
                    <label for="jsRevQtyInput" style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; white-space: nowrap;">납품 수량 (개)</label>
                    <input id="jsRevQtyInput" type="number" min="1" value="10" style="width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: #ffffff; font-size: 15px; font-weight: 700; color: #0f172a; outline: none;" />
                  </div>
                </div>
              </div>

              <!-- 역산 결과 지표 -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background: #ffffff;">
                  <div style="font-size: 12px; font-weight: 700; color: #64748b; white-space: nowrap;">원가 대비 배수</div>
                  <div id="jsRevMultText" style="font-size: 24px; font-weight: 900; color: #0f172a; margin-top: 4px; white-space: nowrap;">1.35 배</div>
                </div>
                <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background: #ffffff;">
                  <div style="font-size: 12px; font-weight: 700; color: #64748b; white-space: nowrap;">매출 기준 마진율 (%)</div>
                  <div id="jsRevMarginText" style="font-size: 24px; font-weight: 900; color: #059669; margin-top: 4px; white-space: nowrap;">25.9 %</div>
                </div>
                <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background: #ffffff;">
                  <div style="font-size: 12px; font-weight: 700; color: #64748b; white-space: nowrap;">원가 기준 수익률 (%)</div>
                  <div id="jsRevMarkupText" style="font-size: 18px; font-weight: 800; color: #334155; margin-top: 4px; white-space: nowrap;">+35.0 %</div>
                </div>
                <div style="border: 1px solid #c7d2fe; border-radius: 12px; padding: 14px; background: #eef2ff;">
                  <div style="font-size: 12px; font-weight: 700; color: #3730a3; white-space: nowrap;">총 납품 순이익</div>
                  <div id="jsRevTotalProfitText" style="font-size: 18px; font-weight: 900; color: #4338ca; margin-top: 4px; white-space: nowrap;">+35,000원</div>
                </div>
              </div>

              <div id="jsRevStatusBox" style="border-radius: 12px; padding: 12px 14px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 13px; font-weight: 700;">
                Win-Win 적정 납품 구간 · 개당 순이익 +3,500원
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    const noticeEl = document.getElementById("jsCopyNotice");
    const showNotice = (msg) => {
      if (!noticeEl) return;
      noticeEl.textContent = msg;
      setTimeout(() => {
        if (noticeEl.textContent === msg) noticeEl.textContent = "";
      }, 1800);
    };

    const renderRecentKeywords = () => {
      const wrap = document.getElementById("jsRecentKeywordsWrap");
      const list = document.getElementById("jsRecentKeywordsList");
      if (!wrap || !list) return;
      if (recentKeywords.length === 0) {
        wrap.style.display = "none";
        return;
      }
      wrap.style.display = "flex";
      list.innerHTML = recentKeywords
        .map(
          (kw) =>
            `<button type="button" data-recent-kw="${kw.replace(/"/g, "&quot;")}" style="padding: 4px 10px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;">${kw} ↗</button>`
        )
        .join("");

      list.querySelectorAll("[data-recent-kw]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const kw = btn.getAttribute("data-recent-kw");
          const kwInput = document.getElementById("jsCoupangKeyword");
          if (kwInput) kwInput.value = kw;
          openCoupangSearchUrl(kw);
        });
      });
    };

    const renderLeft = () => {
      const cost = parseNumber(document.getElementById("jsPureCostInput").value);
      const rule = document.getElementById("jsRoundingRule").value;
      const customMult = parseFloat(document.getElementById("jsCustomMultInput").value) || 1.25;

      const tableData = generateMultiplierTable(cost, {
        maxMultiplier: 2.0,
        step: 0.1,
        roundingRule: rule,
        customMultiplier: customMult
      });

      const rec = tableData.recommendations;
      const cardsWrap = document.getElementById("jsRecommendedCards");
      const cardConfigs = [
        { title: "소모품·경쟁 (1.20배)", data: rec.competitive, highlight: false },
        { title: "★ Win-Win 표준 (1.35배)", data: rec.winWinStandard, highlight: true },
        { title: "소량·직배송 (1.50배)", data: rec.smallLotBuffer, highlight: false }
      ];

      cardsWrap.innerHTML = cardConfigs
        .map((c) => {
          const d = c.data || { supplyPrice: 0, netProfit: 0, marginRate: 0 };
          return `
            <div style="border: ${c.highlight ? "2px solid #10b981" : "1px solid #e2e8f0"}; background: ${c.highlight ? "#ecfdf5" : "#f8fafc"}; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 6px;">
              <div style="font-size: 11px; font-weight: 800; color: ${c.highlight ? "#065f46" : "#475569"}; white-space: nowrap;">${c.title}</div>
              <div style="font-size: 18px; font-weight: 900; color: ${c.highlight ? "#047857" : "#0f172a"}; white-space: nowrap;">${formatKRW(d.supplyPrice)}</div>
              <div style="font-size: 11px; color: #475569; white-space: nowrap;">순익 +${formatKRW(d.netProfit)} (${d.marginRate}%)</div>
              <button type="button" data-copy-val="${formatKRW(d.supplyPrice)}" style="margin-top: 4px; padding: 6px 8px; border-radius: 8px; border: ${c.highlight ? "none" : "1px solid #cbd5e1"}; background: ${c.highlight ? "#059669" : "#ffffff"}; color: ${c.highlight ? "#ffffff" : "#1e293b"}; font-size: 11px; font-weight: 700; cursor: pointer;">
                단가 복사
              </button>
            </div>
          `;
        })
        .join("");

      const allRows = [];
      if (tableData.customRow) {
        allRows.push({ ...tableData.customRow, isCustom: true });
      }
      tableData.rows.forEach((r) => allRows.push({ ...r, isCustom: false }));

      const tbody = document.getElementById("jsMultiplierTbody");
      tbody.innerHTML = allRows
        .map((r) => {
          const isMid = Math.abs(r.multiplier - 1.4) < 0.01 || Math.abs(r.multiplier - 1.3) < 0.01;
          const rowBg = r.isCustom ? "#eef2ff" : isMid ? "#f0fdf4" : "#ffffff";
          const labelText = r.isCustom ? `${r.multiplier.toFixed(2)}배 (지정)` : `${r.multiplier.toFixed(1)}배`;
          return `
            <tr style="border-bottom: 1px solid #f1f5f9; background: ${rowBg};">
              <td style="padding: 10px 12px; font-weight: 800; color: ${r.isCustom ? "#3730a3" : "#0f172a"}; white-space: nowrap;">${labelText}</td>
              <td style="padding: 10px 12px; font-weight: 800; color: #0f172a; white-space: nowrap;">${formatKRW(r.supplyPrice)}</td>
              <td style="padding: 10px 12px; color: #64748b; white-space: nowrap;">${formatKRW(r.vatPrice)}</td>
              <td style="padding: 10px 12px; font-weight: 700; color: ${r.netProfit >= 0 ? "#059669" : "#e11d48"}; white-space: nowrap;">${r.netProfit >= 0 ? "+" : ""}${formatKRW(r.netProfit)}</td>
              <td style="padding: 10px 12px; font-weight: 700; color: #334155; white-space: nowrap;">${r.marginRate}%</td>
              <td style="padding: 10px 12px; text-align: right; white-space: nowrap;">
                <button type="button" data-copy-val="${formatKRW(r.supplyPrice)}" style="padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; font-size: 11px; font-weight: 700; cursor: pointer;">복사</button>
              </td>
            </tr>
          `;
        })
        .join("");

      cardsWrap.querySelectorAll("[data-copy-val]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const val = btn.getAttribute("data-copy-val");
          copyToClipboardSafe(val);
          showNotice(`복사됨: ${val}`);
        });
      });

      tbody.querySelectorAll("[data-copy-val]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const val = btn.getAttribute("data-copy-val");
          copyToClipboardSafe(val);
          showNotice(`복사됨: ${val}`);
        });
      });
    };

    const renderRight = () => {
      const sell = parseNumber(document.getElementById("jsRevSellInput").value);
      const cost = parseNumber(document.getElementById("jsRevCostInput").value);
      const qty = Math.max(1, parseNumber(document.getElementById("jsRevQtyInput").value));

      const res = calculateReverseMargin(sell, cost, qty);

      document.getElementById("jsRevMultText").textContent = `${res.multiplier.toFixed(2)} 배`;
      document.getElementById("jsRevMarginText").textContent = `${res.profitMarginPercent.toFixed(1)} %`;
      document.getElementById("jsRevMarkupText").textContent = `${res.profitOnCostPercent >= 0 ? "+" : ""}${res.profitOnCostPercent.toFixed(1)} %`;
      document.getElementById("jsRevTotalProfitText").textContent = `${res.totalProfit >= 0 ? "+" : ""}${formatKRW(res.totalProfit)}`;

      const statusBox = document.getElementById("jsRevStatusBox");
      statusBox.textContent = `${res.statusLabel} · 개당 순이익 ${res.unitProfit >= 0 ? "+" : ""}${formatKRW(res.unitProfit)}`;
      if (res.unitProfit < 0) {
        statusBox.style.background = "#fff1f2";
        statusBox.style.borderColor = "#fecdd3";
        statusBox.style.color = "#be123c";
      } else {
        statusBox.style.background = "#ecfdf5";
        statusBox.style.borderColor = "#a7f3d0";
        statusBox.style.color = "#065f46";
      }
    };

    const costInput = document.getElementById("jsPureCostInput");
    const customMultInput = document.getElementById("jsCustomMultInput");
    const thumbImg = document.getElementById("jsSelectedThumb");

    costInput.addEventListener("input", () => {
      const n = parseNumber(costInput.value);
      costInput.value = n ? formatKRW(n, false) : "";
      renderLeft();
    });

    customMultInput.addEventListener("input", renderLeft);
    document.getElementById("jsRoundingRule").addEventListener("change", renderLeft);

    container.querySelectorAll("[data-add-cost]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const addVal = parseNumber(btn.getAttribute("data-add-cost"));
        const next = parseNumber(costInput.value) + addVal;
        costInput.value = formatKRW(next, false);
        renderLeft();
      });
    });

    document.getElementById("jsResetCostBtn").addEventListener("click", () => {
      costInput.value = "0";
      renderLeft();
    });

    const revSellInput = document.getElementById("jsRevSellInput");
    const revCostInput = document.getElementById("jsRevCostInput");
    const revQtyInput = document.getElementById("jsRevQtyInput");

    [revSellInput, revCostInput].forEach((inp) => {
      inp.addEventListener("input", () => {
        const n = parseNumber(inp.value);
        inp.value = n ? formatKRW(n, false) : "";
        renderRight();
      });
    });
    revQtyInput.addEventListener("input", renderRight);

    document.getElementById("jsSyncCostBtn").addEventListener("click", () => {
      const leftCost = parseNumber(costInput.value);
      revCostInput.value = formatKRW(leftCost, false);
      renderRight();
      showNotice("좌측 원가 반영 완료");
    });

    const openCoupangAction = () => {
      const kwInput = document.getElementById("jsCoupangKeyword");
      const trimmed = kwInput.value.trim();
      const url = openCoupangSearchUrl(trimmed);
      if (url) {
        recentKeywords = [trimmed, ...recentKeywords.filter((k) => k !== trimmed)].slice(0, 8);
        renderRecentKeywords();
        showNotice(`'${trimmed}' 쿠팡 검색 창 열림`);
      }
    };

    document.getElementById("jsOpenCoupangBtn").addEventListener("click", openCoupangAction);
    document.getElementById("jsCoupangKeyword").addEventListener("keydown", (e) => {
      if (e.key === "Enter") openCoupangAction();
    });

    // 캡처 이미지 붙여넣기 (Cmd+V / Ctrl+V)
    document.addEventListener("paste", (event) => {
      const items = (event.clipboardData || window.clipboardData)?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          const reader = new FileReader();
          reader.onload = (e) => {
            if (thumbImg && e.target && e.target.result) {
              thumbImg.src = e.target.result;
              thumbImg.style.display = "block";
              showNotice("캡처 사진이 적용되었습니다!");
            }
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    });

    // 전체 초기화
    document.getElementById("jsResetAllBtn").addEventListener("click", () => {
      document.getElementById("jsCoupangKeyword").value = "";
      costInput.value = "0";
      customMultInput.value = "1.25";
      revSellInput.value = "0";
      revCostInput.value = "0";
      revQtyInput.value = "1";
      recentKeywords = [];
      renderRecentKeywords();
      if (thumbImg) {
        thumbImg.src = "";
        thumbImg.style.display = "none";
      }
      renderLeft();
      renderRight();
      showNotice("전체 초기화 완료");
    });

    renderLeft();
    renderRight();
  } catch (err) {
    console.error("[mountPriceCalculatorUI 실행 오류]", err);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountPriceCalculatorUI("#app"));
  } else {
    mountPriceCalculatorUI("#app");
  }
}
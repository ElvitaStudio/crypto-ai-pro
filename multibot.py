# -*- coding: utf-8 -*-
import ccxt
import pandas as pd
import pandas_ta as ta  # БИБЛИОТЕКА ИНДИКАТОРОВ
import time
import requests
import json
from datetime import datetime
import mplfinance as mpf
import io
import warnings

# Отключаем лишние предупреждения
warnings.filterwarnings("ignore")

# ================= НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ =================
TELEGRAM_TOKEN = '8433497142:AAFFdThNXlzBDF5rlGR89X35eL3FCA4LKpE' 
CHAT_ID = '-1002734712902'

# Настройки рынка
TIMEFRAME = '15m'          # Для стратегий лучше 15м (меньше шума)
CHART_TIMEFRAME = '1h'     # График шлем часовой, чтобы видеть тренд
LIMIT_OHLCV = 300          # Нужно много свечей для расчета EMA 200
COINS_TO_SCAN = 80         # УВЕЛИЧИЛИ ТОП МОНЕТ

# ================= СИСТЕМНАЯ ЧАСТЬ =================
print("--- Инициализация MULTI-STRATEGY BOT... ---")
exchange = ccxt.binance({
    'enableRateLimit': True,
    'options': {'defaultType': 'future'} 
})

# --- Отправка в Telegram ---
def send_telegram(message, image_buffer=None, symbol_for_link=None):
    try:
        reply_markup = None
        if symbol_for_link:
            clean_pair = symbol_for_link.replace('/', '')
            url_tv = f"https://www.tradingview.com/chart?symbol=BINANCE:{clean_pair}.P"
            url_bin = f"https://www.binance.com/en/futures/{clean_pair}"
            keyboard = {
                "inline_keyboard": [[
                    {"text": "📊 Live График", "url": url_tv},
                    {"text": "💰 Торговать", "url": url_bin}
                ]]
            }
            reply_markup = json.dumps(keyboard)

        if image_buffer:
            url_api = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
            files = {'photo': ('chart.png', image_buffer, 'image/png')}
            data = {"chat_id": CHAT_ID, "caption": message, "parse_mode": "Markdown"}
            if reply_markup: data["reply_markup"] = reply_markup
            requests.post(url_api, data=data, files=files)
        else:
            requests.post(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage", 
                          data={"chat_id": CHAT_ID, "text": message, "parse_mode": "Markdown", "reply_markup": reply_markup})
    except Exception as e:
        print(f"Ошибка TG: {e}")

# --- Генерация графика ---
def generate_chart(symbol, level_price=None):
    try:
        ohlcv = exchange.fetch_ohlcv(symbol, CHART_TIMEFRAME, limit=100)
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df.set_index('timestamp', inplace=True)

        buf = io.BytesIO()
        # Если есть уровень, рисуем его
        if level_price:
            hlines_dict = dict(hlines=[level_price], colors=['blue'], linewidths=[1], alpha=0.5, linestyle='-.')
            mpf.plot(df, type='candle', style='yahoo', volume=True, title=f'\n{symbol} ({CHART_TIMEFRAME})',
                     hlines=hlines_dict, savefig=dict(fname=buf, dpi=100, bbox_inches='tight'))
        else:
            mpf.plot(df, type='candle', style='yahoo', volume=True, title=f'\n{symbol} ({CHART_TIMEFRAME})',
                     savefig=dict(fname=buf, dpi=100, bbox_inches='tight'))
        buf.seek(0)
        return buf
    except:
        return None

# --- Получение ТОП монет ---
def get_top_coins(limit):
    print(f"🔄 Загружаем ТОП-{limit} монет...")
    try:
        tickers = exchange.fetch_tickers()
        pairs = [{'symbol': s, 'vol': d['quoteVolume']} for s, d in tickers.items() 
                 if '/USDT' in s and d['quoteVolume'] and s.isascii()]
        df = pd.DataFrame(pairs).sort_values(by='vol', ascending=False)
        return df['symbol'].head(limit).tolist()
    except:
        return []

# --- ГЛАВНЫЙ МОЗГ (АНАЛИЗ) ---
def analyze_strategy(symbols):
    print(f"\n--- Анализ стратегий: {datetime.now().strftime('%H:%M:%S')} ---")
    
    for symbol in symbols:
        try:
            ohlcv = exchange.fetch_ohlcv(symbol, TIMEFRAME, limit=LIMIT_OHLCV)
            if not ohlcv: continue
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            
            # === РАСЧЕТ ИНДИКАТОРОВ (PANDAS TA) ===
            # 1. RSI (для разворотов)
            df['rsi'] = df.ta.rsi(length=14)
            # 2. Bollinger Bands (для перегрева)
            bb = df.ta.bbands(length=20, std=2)
            df['upper'] = bb['BBU_20_2.0']
            df['lower'] = bb['BBL_20_2.0']
            # 3. EMA (для тренда)
            df['ema20'] = df.ta.ema(length=20)
            df['ema50'] = df.ta.ema(length=50)
            df['ema200'] = df.ta.ema(length=200)
            # 4. ADX (сила тренда)
            adx_df = df.ta.adx(length=14)
            df['adx'] = adx_df['ADX_14']

            # Последние данные
            curr = df.iloc[-1]      # Текущая свеча (еще формируется)
            prev = df.iloc[-2]      # Предыдущая (закрытая)
            price = curr['close']
            
            # Данные для SFP (High/Low 24h)
            ticker = exchange.fetch_ticker(symbol)
            h24 = ticker['high']
            l24 = ticker['low']

            signal = None
            direction = None
            strat_name = None
            reason = ""
            level_draw = None

            # ================= СТРАТЕГИИ =================

            # 1. 🔫 SNIPER (Контртренд: Вылет за Боллинджер + RSI)
            # Шорт: Цена выше верхней линии + RSI > 70 + Свеча закрылась красной (разворот)
            if prev['close'] > prev['upper'] and prev['rsi'] > 70 and curr['close'] < prev['close']:
                signal = True
                direction = "SHORT"
                strat_name = "🔫 SNIPER (Разворот)"
                reason = f"Вылет за BB + RSI {prev['rsi']:.1f}"
                level_draw = prev['upper']

            # Лонг: Цена ниже нижней линии + RSI < 30 + Свеча зеленая
            elif prev['close'] < prev['lower'] and prev['rsi'] < 30 and curr['close'] > prev['close']:
                signal = True
                direction = "LONG"
                strat_name = "🔫 SNIPER (Отскок)"
                reason = f"Прокол дна BB + RSI {prev['rsi']:.1f}"
                level_draw = prev['lower']

            # 2. 🌊 TREND (Сила: EMA Веер + ADX)
            # Лонг: EMA20 > EMA50 > EMA200 (идеальный аптренд) + ADX > 25 (есть сила)
            elif (curr['ema20'] > curr['ema50'] > curr['ema200']) and curr['adx'] > 25:
                # Фильтр: входим только на небольшом откате к EMA20, а не на хаях
                if curr['low'] <= curr['ema20'] and curr['close'] > curr['ema20']:
                    signal = True
                    direction = "LONG"
                    strat_name = "🌊 TREND (Pullback)"
                    reason = f"Trend is Friend. ADX {curr['adx']:.1f}. Откат к EMA20"
                    level_draw = curr['ema20']

            # 3. 🐋 SFP (Ложный пробой уровня 24ч)
            # Цена обновила Хай 24ч, но вернулась под него (сбор стопов)
            elif prev['high'] > h24 and curr['close'] < h24:
                signal = True
                direction = "SHORT"
                strat_name = "🐋 SFP (Сбор ликвидности)"
                reason = "Ложный пробой 24h High"
                level_draw = h24
            
            # Цена обновила Лой 24ч, но вернулась над него
            elif prev['low'] < l24 and curr['close'] > l24:
                signal = True
                direction = "LONG"
                strat_name = "🐋 SFP (Сбор ликвидности)"
                reason = "Ложный пробой 24h Low"
                level_draw = l24

            # ================= ОТПРАВКА =================
            if signal:
                # Расчет Стопа и Тейка
                atr = (prev['high'] - prev['low']) # Берем волатильность свечи
                if direction == "LONG":
                    stop = price - (atr * 1.5) # Стоп = 1.5 свечи назад
                    take = price + (atr * 4.5) # Тейк 1:3
                else:
                    stop = price + (atr * 1.5)
                    take = price - (atr * 4.5)
                    risk_perc = abs(price - stop) / price * 100
                
                # Фильтр: не шлем, если стоп слишком далеко (>3%) или близко (<0.2%)
                if 0.2 < risk_perc < 3.0:
                    icon = "🟢" if direction == "LONG" else "🔴"
                    clean_sym = symbol.split(':')[0]
                    
                    msg = (
                        f"{icon} {strat_name} | `{clean_sym}`\n"
                        f"Причина: {reason}\n\n"
                        f"📊 ВХОД: {price}\n"
                        f"🛑 Стоп: {stop:.4f} ({risk_perc:.2f}%)\n"
                        f"💰 Тейк: {take:.4f} (R:R 1:3)"
                    )
                    
                    print(f"!!! СИГНАЛ: {symbol} ({strat_name})")
                    chart = generate_chart(symbol, level_draw)
                    send_telegram(msg, chart, symbol)

            # Пауза, чтобы не забанил API (сканируем много монет)
            time.sleep(0.3)

        except Exception as e:
            continue

# --- ЗАПУСК ---
if __name__ == "__main__":
    send_telegram(f"🤖 MULTIBOT v1.0 Запущен!\nСтратегии: Sniper, Trend, SFP\nМонет: {COINS_TO_SCAN}")
    coins = get_top_coins(COINS_TO_SCAN)
    
    while True:
        analyze_strategy(coins)
        # Каждые 30 минут обновляем список топ монет
        if datetime.now().minute % 30 == 0:
            coins = get_top_coins(COINS_TO_SCAN)
        
        print("Ожидание 3 минуты...")
        time.sleep(180)
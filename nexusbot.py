# -*- coding: utf-8 -*-
import ccxt
import pandas as pd
import pandas_ta as ta
import time
import requests
import json
from datetime import datetime
import mplfinance as mpf
import io
import numpy as np
import warnings

warnings.filterwarnings("ignore")

# ================= НАСТРОЙКИ NEXUS =================
TELEGRAM_TOKEN = '7852773083:AAEAuQQQxIfurVjgQZdKTvNmgIDw_visFG8' 
CHAT_ID = '-1002455674147'

# Настройки
TIMEFRAME = '15m'          # 15 минут - идеально для каналов
LIMIT_OHLCV = 100          
COINS_TO_SCAN = 60         
STD_DEV_MULT = 2.0         # Ширина канала (стандартное отклонение)

# ================= СИСТЕМА =================
print("--- Инициализация NEXUS BOT (VWAP + LinReg)... ---")
exchange = ccxt.binance({
    'enableRateLimit': True,
    'options': {'defaultType': 'future'} 
})

# --- Телеграм ---
def send_telegram(message, image_buffer=None):
    try:
        if image_buffer:
            url_api = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
            files = {'photo': ('chart.png', image_buffer, 'image/png')}
            data = {"chat_id": CHAT_ID, "caption": message, "parse_mode": "Markdown"}
            requests.post(url_api, data=data, files=files)
        else:
            requests.post(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage", 
                          data={"chat_id": CHAT_ID, "text": message, "parse_mode": "Markdown"})
    except Exception as e:
        print(f"Error TG: {e}")

# --- График с Каналом и VWAP ---
def generate_chart(symbol, df, entry_price, direction):
    try:
        # Рисуем последние 60 свечей
        chart_df = df.tail(60).copy()
        
        buf = io.BytesIO()
        
        # Добавляем графики
        add_plots = [
            # VWAP (Желтая линия)
            mpf.make_addplot(chart_df['vwap'], color='gold', width=1.5),
            # Верхняя граница канала (Красная)
            mpf.make_addplot(chart_df['upper'], color='red', width=0.8, linestyle='--'),
            # Нижняя граница канала (Зеленая)
            mpf.make_addplot(chart_df['lower'], color='green', width=0.8, linestyle='--'),
            # Средняя линия (Серая)
            mpf.make_addplot(chart_df['linreg'], color='gray', width=0.5)
        ]

        # Маркер входа
        signal_points = [np.nan] * len(chart_df)
        if direction == 'LONG':
            signal_points[-1] = chart_df['low'].iloc[-1] * 0.998
            marker = '^'
            color = 'lime'
        else:
            signal_points[-1] = chart_df['high'].iloc[-1] * 1.002
            marker = 'v'
            color = 'fuchsia'

        add_plots.append(mpf.make_addplot(signal_points, type='scatter', markersize=200, marker=marker, color=color))

        title_text = f"\n{symbol} NEXUS CHANNEL ({direction})"
        
        mpf.plot(chart_df, type='candle', style='yahoo', volume=True, 
                 title=title_text,
                 addplot=add_plots,
                 savefig=dict(fname=buf, dpi=100, bbox_inches='tight'))
        buf.seek(0)
        return buf
    except Exception as e:
        print(f"Chart Error: {e}")
        return None

# --- Получение списка монет ---
def get_top_coins(limit):
    try:
        tickers = exchange.fetch_tickers()
        pairs = [{'symbol': s, 'vol': d['quoteVolume']} for s, d in tickers.items() 
                 if '/USDT' in s and d['quoteVolume'] and s.isascii()]
        df = pd.DataFrame(pairs).sort_values(by='vol', ascending=False)
        return df['symbol'].head(limit).tolist()
    except:
        return []

# --- МОЗГ NEXUS ---
def analyze_nexus(symbols):
    print(f"\n--- NEXUS Scan: {datetime.now().strftime('%H:%M:%S')} ---")
    
    for symbol in symbols:
        try:
            ohlcv = exchange.fetch_ohlcv(symbol, TIMEFRAME, limit=LIMIT_OHLCV)
            if not ohlcv: continue
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            
            # === РАСЧЕТ ИНДИКАТОРОВ ===
# 1. VWAP (Справедливая цена)
            df.ta.vwap(append=True)
            # Если vwap не посчитался (мало данных), пропускаем
            if 'VWAP_D' not in df.columns: continue
            df['vwap'] = df['VWAP_D']

            # 2. Linear Regression Channel (Канал Регрессии)
            # Средняя линия
            df['linreg'] = ta.linreg(df['close'], length=20, offset=0)
            # Стандартное отклонение для ширины канала
            df['stdev'] = ta.stdev(df['close'], length=20)
            
            df['upper'] = df['linreg'] + (df['stdev'] * STD_DEV_MULT)
            df['lower'] = df['linreg'] - (df['stdev'] * STD_DEV_MULT)
            
            # Текущие данные
            curr = df.iloc[-1]
            prev = df.iloc[-2]
            
            # Угол наклона канала (Тренд)
            slope = df['linreg'].iloc[-1] - df['linreg'].iloc[-5]
            
            signal = False
            direction = ""
            reason = ""

            # === ЛОГИКА ===
            
            # LONG SETUP:
            # 1. Канал смотрит вверх (slope > 0)
            # 2. Цена закрылась НИЖЕ VWAP (дешево)
            # 3. Цена коснулась или пробила НИЖНЮЮ границу канала (перепроданность)
            # 4. Зеленая свеча (реакция покупателя)
            if slope > 0:
                if curr['close'] < curr['vwap'] and curr['low'] <= curr['lower']:
                    if curr['close'] > curr['open']: # Зеленая свеча
                        signal = True
                        direction = "LONG"
                        reason = "Касание дна канала + ниже VWAP"

            # SHORT SETUP:
            # 1. Канал смотрит вниз (slope < 0)
            # 2. Цена закрылась ВЫШЕ VWAP (дорого)
            # 3. Цена коснулась или пробила ВЕРХНЮЮ границу канала (перекупленность)
            # 4. Красная свеча
            elif slope < 0:
                if curr['close'] > curr['vwap'] and curr['high'] >= curr['upper']:
                    if curr['close'] < curr['open']: # Красная свеча
                        signal = True
                        direction = "SHORT"
                        reason = "Касание верха канала + выше VWAP"

            if signal:
                clean_sym = symbol.split(':')[0]
                price = curr['close']
                
                # Расчет ATR для стопа (динамический стоп)
                atr = (curr['high'] - curr['low'])
                
                if direction == "LONG":
                    stop = price - (atr * 2) # Стоп за волатильность
                    take = curr['linreg'] # Тейк на возврат к средней линии
                    # Если до тейка мало места - целимся в верхнюю границу
                    if (take - price) < (price - stop):
                        take = curr['upper']
                else:
                    stop = price + (atr * 2)
                    take = curr['linreg']
                    if (price - take) < (stop - price):
                        take = curr['lower']
                
                risk_perc = abs(price - stop) / price * 100
                reward_perc = abs(price - take) / price * 100
                
                if risk_perc == 0: continue
                rr = reward_perc / risk_perc
                
                # Фильтр: Если прибыль меньше риска, не входим
                if rr < 1.0: continue

                msg = (
                    f"🌌 NEXUS: STATISTICAL | `{clean_sym}`\n"
                    f"Причина: {reason}\n"
                    f"📊 КАНАЛ: Наклон {slope:.4f}\n\n"
                    f"⚡ СИГНАЛ: {direction}\n"
                    f"🎯 Вход: {price}\n"
                    f"🛑 Стоп: {stop:.4f} (-{risk_perc:.2f}%)\n"
                    f"💰 Тейк: {take:.4f} (R:R {rr:.2f})"
                )
                
                print(f"!!! СИГНАЛ NEXUS: {symbol}")
                chart = generate_chart(symbol, df, price, direction)
                send_telegram(msg, chart)
                
                time.sleep(5)

        except Exception as e:
            # print(f"Error {symbol}: {e}")
            continue

# --- ЗАПУСК ---
if __name__ == "__main__":
    send_telegram("🌌 NEXUS BOT Запущен!\nСтратегия: VWAP + Regression Channel")
    coins = get_top_coins(COINS_TO_SCAN)
    
    while True:
        analyze_nexus(coins)
        if datetime.now().minute % 60 == 0:
            coins = get_top_coins(COINS_TO_SCAN)
        
        print("Сканирование завершено. Ждем 2 минуты...")
        time.sleep(120)
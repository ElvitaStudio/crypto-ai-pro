# -*- coding: utf-8 -*-
import ccxt
import pandas as pd
import time
import requests
import json
from datetime import datetime
import mplfinance as mpf
import io
import numpy as np
import warnings

warnings.filterwarnings("ignore")

# ================= НАСТРОЙКИ TITAN =================
TELEGRAM_TOKEN = '7615835464:AAEQIMdf3mD9ym0TyO3ZtZ8p1UD8VQrFSYs' 
CHAT_ID = '-1002728849341'

# Настройки
TIMEFRAME = '15m'          
LIMIT_OHLCV = 200          
COINS_TO_SCAN = 50         
FRACTAL_WINDOW = 5         

# ================= СИСТЕМА =================
print("--- Инициализация TITAN BOT v1.1 (Full Trade Setup)... ---")
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

# --- График с Уровнями ---
def generate_chart(symbol, level_price, direction, candles_df):
    try:
        df = candles_df.tail(60).copy()
        buf = io.BytesIO()
        
        hlines_dict = dict(hlines=[level_price], colors=['blue'], linewidths=[1.5], alpha=0.8, linestyle='-')
        
        signal_points = [np.nan] * len(df)
        if direction == 'LONG':
            signal_points[-1] = df['low'].iloc[-1] * 0.998
            marker = '^'
            color = 'green'
        else:
            signal_points[-1] = df['high'].iloc[-1] * 1.002
            marker = 'v'
            color = 'red'

        ap = mpf.make_addplot(signal_points, type='scatter', markersize=150, marker=marker, color=color)

        title_text = f"\n{symbol} LEVEL RETEST ({direction})"
        
        mpf.plot(df, type='candle', style='yahoo', volume=True, 
                 title=title_text,
                 hlines=hlines_dict,
                 addplot=ap,
                 savefig=dict(fname=buf, dpi=100, bbox_inches='tight'))
        buf.seek(0)
        return buf
    except Exception as e:
        return None

# --- Поиск Фракталов ---
def find_levels(df, window=5):
    levels = []
    for i in range(window, len(df) - window):
        is_high = True
        is_low = True
        for j in range(1, window + 1):
            if df['high'].iloc[i] <= df['high'].iloc[i-j] or df['high'].iloc[i] <= df['high'].iloc[i+j]:
                is_high = False
            if df['low'].iloc[i] >= df['low'].iloc[i-j] or df['low'].iloc[i] >= df['low'].iloc[i+j]:
                is_low = False
        
        if is_high:
            levels.append({'price': df['high'].iloc[i], 'type': 'RESISTANCE', 'index': i})
        if is_low:
            levels.append({'price': df['low'].iloc[i], 'type': 'SUPPORT', 'index': i})     
    return levels

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

# --- МОЗГ ТИТАНА ---
def analyze_structure(symbols):
    print(f"\n--- Titan Scan: {datetime.now().strftime('%H:%M:%S')} ---")
    
    for symbol in symbols:
        try:
            ohlcv = exchange.fetch_ohlcv(symbol, TIMEFRAME, limit=LIMIT_OHLCV)
            if not ohlcv: continue
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            
            current_close = df['close'].iloc[-1]
            current_open = df['open'].iloc[-1]
            
            all_levels = find_levels(df, FRACTAL_WINDOW)
            
            relevant_levels = []
            for lvl in all_levels:
                if lvl['index'] > (LIMIT_OHLCV - 100):
                    diff = abs(current_close - lvl['price']) / current_close * 100
                    if diff < 0.8:
                        relevant_levels.append(lvl)
            
            if not relevant_levels: continue

            level = min(relevant_levels, key=lambda x: abs(x['price'] - current_close))
            lvl_price = level['price']
            
            signal = False
            direction = ""
            desc = ""

            # ЛОГИКА
            if current_close > lvl_price and current_open < current_close:
                if level['type'] == 'RESISTANCE':
                    body_size = abs(current_close - current_open)
                    if body_size > (df['high'].iloc[-1] - df['low'].iloc[-1]) * 0.5:
                        signal = True
                        direction = "LONG"
                        desc = "Ретест зеркального уровня (R -> S)"

            elif current_close < lvl_price and current_open > current_close:
                if level['type'] == 'SUPPORT':
                    body_size = abs(current_close - current_open)
                    if body_size > (df['high'].iloc[-1] - df['low'].iloc[-1]) * 0.5:
                        signal = True
                        direction = "SHORT"
                        desc = "Ретест зеркального уровня (S -> R)"

            if signal:
                clean_sym = symbol.split(':')[0]
                
                # РАСЧЕТ TP и SL
                if direction == "LONG":
                    # Стоп на 0.5% ниже уровня
                    stop_loss = lvl_price * 0.995 
                    risk = current_close - stop_loss
                    # Тейк 1 к 3
                    take_profit = current_close + (risk * 3)
                else:
                    # Стоп на 0.5% выше уровня
                    stop_loss = lvl_price * 1.005
                    risk = stop_loss - current_close
                    take_profit = current_close - (risk * 3)
                
                # Если риск слишком маленький (уровень слишком близко), пропускаем
                if risk == 0: continue
                
                msg = (
                    f"🏛 TITAN: PRICE ACTION | `{clean_sym}`\n"
                    f"Формация: {desc}\n"
                    f"🧱 УРОВЕНЬ: {lvl_price}\n\n"
                    f"⚡ СИГНАЛ: {direction}\n"
                    f"🎯 Вход: {current_close}\n"
                    f"🛑 Стоп: {stop_loss:.4f} (За уровень)\n"
                    f"💰 Тейк: {take_profit:.4f} (R:R 1:3)"
                )
                
                print(f"!!! СИГНАЛ TITAN: {symbol}")
                chart = generate_chart(symbol, lvl_price, direction, df)
                send_telegram(msg, chart)
                
                time.sleep(5)

        except Exception as e:
            continue

# --- ЗАПУСК ---
if __name__ == "__main__":
    send_telegram("🏛 TITAN BOT v1.1 Запущен!\n(Теперь с расчетом Тейка и Стопа)")
    coins = get_top_coins(COINS_TO_SCAN)
    
    while True:
        analyze_structure(coins)
        if datetime.now().minute % 60 == 0:
            coins = get_top_coins(COINS_TO_SCAN)
        
        print("Сканирование завершено. Ждем 3 минуты...")
        time.sleep(180)
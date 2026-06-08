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
import numpy as np # Нужно для маркеров
import warnings

warnings.filterwarnings("ignore")

# ================= НАСТРОЙКИ =================
TELEGRAM_TOKEN = '7829149447:AAEdvgCeaNVf0v30q6P7g7HmH428n_Etlb4' 
CHAT_ID = '-1002578978894'

# Настройки стратегии
TIMEFRAME = '5m'           
CHART_TIMEFRAME = '15m'    
LIMIT_OHLCV = 100          
COINS_TO_SCAN = 60         
VOL_THRESHOLD = 2.5        

# ================= СИСТЕМА =================
print("--- Инициализация FIBO-VELOCITY BOT v1.1 (Markers + Link Fix)... ---")
exchange = ccxt.binance({
    'enableRateLimit': True,
    'options': {'defaultType': 'future'} 
})

# --- Отправка в Telegram (ИСПРАВЛЕНА ССЫЛКА) ---
def send_telegram(message, image_buffer=None, symbol_for_link=None):
    try:
        reply_markup = None
        if symbol_for_link:
            clean_pair = symbol_for_link.replace('/', '')
            # Убрали .P, чтобы открывался спот, если фьючерса нет на TV
            url_tv = f"https://www.tradingview.com/chart?symbol=BINANCE:{clean_pair}"
            url_bin = f"https://www.binance.com/en/futures/{clean_pair}"
            keyboard = {
                "inline_keyboard": [[
                    {"text": "📉 График TV", "url": url_tv},
                    {"text": "🔥 Binance", "url": url_bin}
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
                          data={"chat_id": CHAT_ID, "text": message, "parse_mode": "Markdown"})
    except Exception as e:
        print(f"Error TG: {e}")

# --- График с уровнями и МАРКЕРОМ ВХОДА ---
def generate_chart(symbol, fibo_levels):
    try:
        ohlcv = exchange.fetch_ohlcv(symbol, CHART_TIMEFRAME, limit=80)
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df.set_index('timestamp', inplace=True)

        buf = io.BytesIO()
        
        # 1. Линии Фибо
        hlines_dict = dict(hlines=[fibo_levels['0.5'], fibo_levels['0.618']], 
                           colors=['orange', 'green'], linewidths=[1, 2], alpha=0.8, linestyle='-.')

        # 2. Маркер входа (Стрелка вверх)
        # Создаем пустой список с NaN
        entry_marker = [np.nan] * len(df)
        # На последней свече ставим цену входа
        entry_marker[-1] = fibo_levels['0.618'] 
        
        # Добавляем маркер на график
        ap = mpf.make_addplot(entry_marker, type='scatter', markersize=150, marker='^', color='green')

        mpf.plot(df, type='candle', style='yahoo', volume=True, 
                 title=f'\n{symbol} Fibo Entry',
                 hlines=hlines_dict,
                 addplot=ap, # Добавляем наш маркер
                 savefig=dict(fname=buf, dpi=100, bbox_inches='tight'))
        buf.seek(0)
        return buf
    except Exception as e:
        print(f"Ошибка графика: {e}")
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

# --- АНАЛИЗАТОР ---
def analyze_fibo(symbols):
    print(f"\n--- Scan Fibo-Velocity: {datetime.now().strftime('%H:%M:%S')} ---")
    
    for symbol in symbols:
        try:
            ohlcv = exchange.fetch_ohlcv(symbol, TIMEFRAME, limit=LIMIT_OHLCV)
            if not ohlcv: continue
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            current_price = df['close'].iloc[-1]
            
            lookback = 50
            recent_data = df.iloc[-lookback:]
            swing_high = recent_data['high'].max()
            swing_low = recent_data['low'].min()
            
            growth_perc = (swing_high - swing_low) / swing_low * 100
            if growth_perc < 2.0: continue 

            diff = swing_high - swing_low
            fibo_05 = swing_high - (diff * 0.5)
            fibo_618 = swing_high - (diff * 0.618)
            
            avg_vol = df['volume'].iloc[:-5].mean()
            max_vol_recent = recent_data['volume'].max()
            has_velocity = max_vol_recent > (avg_vol * VOL_THRESHOLD)
            
            if not has_velocity: continue

            if fibo_618 <= current_price <= fibo_05:
                entry = current_price
                stop = swing_low
                target = swing_high
                
                risk = abs(entry - stop)
                reward = abs(target - entry)
                if risk == 0: continue
                rr_ratio = reward / risk

                if rr_ratio < 1.5: continue

                risk_perc = (risk / entry) * 100
                clean_sym = symbol.split(':')[0]
                msg = (
                    f"🟢 `{clean_sym}`\n"
                    f"Тренд: Рост +{growth_perc:.2f}% (Объемы есть!)\n\n"
                    f"🎯 **ВХОД (GOLDEN POCKET):**\n"
                    f"Цена: {entry}\n"
                    f"Зона 0.618: {fibo_618:.4f}\n\n"
                    f"🛑 Стоп: {stop:.4f} (-{risk_perc:.2f}%)\n"
                    f"💰 Тейк: {swing_high:.4f} (Перехай)"
                )
                
                print(f"!!! СИГНАЛ FIBO: {clean_sym}")
                levels = {'0.5': fibo_05, '0.618': fibo_618}
                chart = generate_chart(symbol, levels)
                send_telegram(msg, chart, symbol)
                
                time.sleep(5) # Пауза побольше, чтобы не спамить одной монетой

            time.sleep(0.1)

        except Exception as e:
            continue

# --- ЗАПУСК ---
if __name__ == "__main__":
    send_telegram(f"📐 FIBO-BOT v1.1 Запущен!\n(Маркеры входа + Исправлены ссылки)")
    coins = get_top_coins(COINS_TO_SCAN)
    
    while True:
        analyze_fibo(coins)
        if datetime.now().minute % 30 == 0:
            coins = get_top_coins(COINS_TO_SCAN)
        
        print("Ждем 2 минуты...")
        time.sleep(120)                                 
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

# ================= НАСТРОЙКИ SHORT =================
TELEGRAM_TOKEN = '8433497142:AAFFdThNXlzBDF5rlGR89X35eL3FCA4LKpE' 
CHAT_ID = '-1002734712902'

# Только ШОРТ. Только 0.618.
TIMEFRAME = '5m'           
CHART_TIMEFRAME = '15m'    
LIMIT_OHLCV = 100          
COINS_TO_SCAN = 60         
VOL_THRESHOLD = 2.0        

# ================= СИСТЕМА =================
print("--- Инициализация FIBO-SHORT GOLD (Classic Strategy)... ---")
exchange = ccxt.binance({
    'enableRateLimit': True,
    'options': {'defaultType': 'future'} 
})

# --- Отправка в Telegram ---
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

# --- График со СТРЕЛКОЙ ВНИЗ ---
def generate_chart(symbol, fibo_levels, df_chart):
    try:
        df = df_chart.tail(80).copy()
        buf = io.BytesIO()
        
        # Уровни (Красные для шорта)
        hlines_dict = dict(hlines=[fibo_levels['0.5'], fibo_levels['0.618']], 
                           colors=['orange', 'red'], linewidths=[1, 2], alpha=0.8, linestyle='-.')

        # Стрелка ВНИЗ (Вход)
        signal_points = [np.nan] * len(df)
        signal_points[-1] = df['high'].iloc[-1] * 1.005 
        
        ap = mpf.make_addplot(signal_points, type='scatter', markersize=200, marker='v', color='red')

        mpf.plot(df, type='candle', style='yahoo', volume=True, 
                 title=f'\n{symbol} SHORT SETUP (0.618)',
                 hlines=hlines_dict,
                 addplot=ap,
                 savefig=dict(fname=buf, dpi=100, bbox_inches='tight'))
        buf.seek(0)
        return buf
    except Exception as e:
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
def analyze_fibo_short(symbols):
    print(f"\n--- Scan Fibo Short: {datetime.now().strftime('%H:%M:%S')} ---")
    
    for symbol in symbols:
        try:
            ohlcv = exchange.fetch_ohlcv(symbol, TIMEFRAME, limit=LIMIT_OHLCV)
            if not ohlcv: continue
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            
            current_price = df['close'].iloc[-1]
            
            lookback = 60
            recent_data = df.iloc[-lookback:]
            
            swing_high = recent_data['high'].max()
            swing_low = recent_data['low'].min()
            idx_high = recent_data['high'].idxmax()
            idx_low = recent_data['low'].idxmin()
            
            # 1. ПРАВИЛО: Тренд должен быть ВНИЗ
            # (Минимум был ПОЗЖЕ Максимума)
            if idx_low < idx_high: continue 

            diff = swing_high - swing_low
            move_perc = (diff / swing_low) * 100
            
            # 2. ПРАВИЛО: Падение должно быть заметным (>2%)
            if move_perc < 2.0: continue

            # 3.ПРАВИЛО ОБЪЕМА
            avg_vol = df['volume'].iloc[:-5].mean()
            max_vol_recent = recent_data['volume'].max()
            if max_vol_recent < (avg_vol * VOL_THRESHOLD): continue

            # === МАТЕМАТИКА ФИБОНАЧЧИ (ЗЕРКАЛЬНАЯ) ===
            # Мы ищем отскок снизу вверх, поэтому прибавляем к Low
            fibo_05 = swing_low + (diff * 0.5)
            fibo_618 = swing_low + (diff * 0.618) 
            
            # СИГНАЛ: Цена ОТСКОЧИЛА ВВЕРХ в зону продажи
            if fibo_05 <= current_price <= fibo_618:
                
                entry = current_price
                stop = swing_high # Стоп за хай (начало падения)
                take = swing_low  # Тейк на обновление лоя
                
                risk = stop - entry
                reward = entry - take
                
                if risk <= 0: continue
                rr = reward / risk
                
                if rr < 1.5: continue
                
                risk_perc = (risk / entry) * 100
                clean_sym = symbol.split(':')[0]
                
                msg = (
                    f"🔴 `{clean_sym}`\n"
                    f"📉 Слив: -{move_perc:.2f}% (Объемы есть)\n\n"
                    f"🎯 **ВХОД (SHORT):**\n"
                    f"Цена: {entry}\n"
                    f"Зона 0.618: {fibo_618:.4f}\n\n"
                    f"🛑 Стоп: {stop:.4f} (-{risk_perc:.2f}%)\n"
                    f"💰 Тейк: {take:.4f} (R:R {rr:.1f})"
                )
                
                print(f"!!! СИГНАЛ SHORT: {clean_sym}")
                levels = {'0.5': fibo_05, '0.618': fibo_618}
                chart = generate_chart(symbol, levels, df)
                send_telegram(msg, chart)
                
                time.sleep(5)

        except Exception as e:
            continue

# --- ЗАПУСК ---
if __name__ == "__main__":
    send_telegram(f"🔻 FIBO-SHORT GOLD Запущен!\n(Классическая стратегия: Только Short 0.618)")
    coins = get_top_coins(COINS_TO_SCAN)
    
    while True:
        analyze_fibo_short(coins)
        if datetime.now().minute % 30 == 0:
            coins = get_top_coins(COINS_TO_SCAN)
        
        print("Ждем 2 минуты...")
        time.sleep(120)
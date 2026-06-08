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
import warnings
import os
import csv
import sys

# Отключаем предупреждения
warnings.filterwarnings("ignore", category=UserWarning)
warnings.simplefilter(action='ignore', category=FutureWarning)

# ================= НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ =================
TELEGRAM_TOKEN = '7550542378:AAERLC0CFYXYq2ivK1yPuMktFTtxA3AO5Zg' 
CHAT_ID = '-1003521529329'
TG_RESULTS_ID = '-1003439293125' # <--- КУДА СЛАТЬ РЕЗУЛЬТАТЫ (Поставил тот же канал)

# Настройки стратегии
TIMEFRAME = '5m'           
CHART_TIMEFRAME = '15m'    
LIMIT_OHLCV = 50           
CHART_LIMIT = 100          
VOL_MULTIPLIER = 5.0       
PRICE_CHANGE_PERC = 1.5    
LEVEL_DISTANCE_PERC = 1.0  
COINS_TO_SCAN = 40         

# --- ФАЙЛЫ ДЛЯ ОБУЧЕНИЯ ---
DB_FILENAME = 'Training_data_b.csv'       
TRADES_FILENAME = 'active_trades_b.json'  

active_trades = [] 

# ================= СИСТЕМНАЯ ЧАСТЬ =================
print("--- Инициализация бота v6.0 (AI Optimized: CatBoost Logic) ---")
exchange = ccxt.binance({
    'enableRateLimit': True,
    'options': {'defaultType': 'future'} 
})

# ==========================================
#        ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ==========================================
def save_trades_to_json():
    try:
        with open(TRADES_FILENAME, 'w') as f:
            json.dump(active_trades, f, indent=4)
    except Exception as e:
        print(f"⚠️ Ошибка сохранения памяти: {e}")

def load_trades_from_json():
    global active_trades
    if os.path.exists(TRADES_FILENAME):
        try:
            with open(TRADES_FILENAME, 'r') as f:
                active_trades = json.load(f)
            print(f"📂 Загружено {len(active_trades)} активных сделок.")
        except:
            active_trades = []

def format_duration(seconds):
    seconds = int(seconds)
    if seconds < 60: return f"{seconds} сек"
    elif seconds < 3600: return f"{seconds // 60} мин {seconds % 60} сек"
    else: return f"{seconds // 3600} ч {(seconds % 3600) // 60} мин"

# --- ЗАПИСЬ В CSV (ДЛЯ ИИ) ---
def log_trade_result(trade_data, result_status, duration):
    file_exists = os.path.isfile(DB_FILENAME)
    try:
        with open(DB_FILENAME, mode='a', newline='') as file:
            writer = csv.writer(file)
            if not file_exists:
                writer.writerow(['Date', 'Symbol', 'Side', 'Price', 'Vol_Ratio', 'RSI', 'ADX', 'BTC_Corr', 'Dist_EMA', 'Duration_Sec', 'RESULT'])
            
            feats = trade_data.get('features', {})
            writer.writerow([
                pd.Timestamp.now(), trade_data['symbol'], trade_data['side'], trade_data['entry'], 
                feats.get('vol_ratio', 0), feats.get('rsi', 0), feats.get('adx', 0), 
                feats.get('btc_corr', 0), feats.get('dist_ema', 0),
                round(duration, 2), result_status 
            ])
        print(f"💾 Данные обучения сохранены для {trade_data['symbol']}")
    except Exception as e:
        print(f"Ошибка CSV: {e}")

# --- ТРЕКИНГ СДЕЛОК ---
def track_active_trades():
    global active_trades
    if not active_trades: return
    trades_to_remove = []

    for trade in active_trades:
        try:
            ticker = exchange.fetch_ticker(trade['symbol'])
            current_price = ticker['last']
            finish = False
            status = 0
            msg = ""
            
            dur = time.time() - trade['start_time']
            
            # --- LONG ---
            if trade['side'] == 'LONG':
                if current_price >= trade['tp']:
                    pct = ((current_price - trade['entry']) / trade['entry']) * 100
                    msg = (f"✅ TAKE PROFIT (Bot 2): `{trade['symbol']}`\n"
                           f"📈 Прибыль: `+{pct:.2f}%`\n"
                           f"⏱ Время: `{format_duration(dur)}`\n"
                           f"💰 Выход: `{current_price}`")
                    finish = True; status = 1
                elif current_price <= trade['sl']:
                    pct = ((trade['entry'] - current_price) / trade['entry']) * 100
                    msg = (f"❌ STOP LOSS (Bot 2): `{trade['symbol']}`\n"
                           f"📉 Убыток: `-{pct:.2f}%`\n"
                           f"⏱ Время: `{format_duration(dur)}`\n"
                           f"💀 Выход: `{current_price}`")
                    finish = True; status = 0
            
            # --- SHORT ---
            elif trade['side'] == 'SHORT':
                if current_price <= trade['tp']:
                    pct = ((trade['entry'] - current_price) / trade['entry']) * 100
                    msg = (f"✅ TAKE PROFIT (Bot 2): `{trade['symbol']}`\n"
                           f"📉 Прибыль: `+{pct:.2f}%`\n"
                           f"⏱ Время: `{format_duration(dur)}`\n"
                           f"💰 Выход: `{current_price}`")
                    finish = True; status = 1
                elif current_price >= trade['sl']:
                    pct = ((current_price - trade['entry']) / trade['entry']) * 100
                    msg = (f"❌ STOP LOSS (Bot 2): `{trade['symbol']}`\n"
                           f"📈 Убыток: `-{pct:.2f}%`\n"
                           f"⏱ Время: `{format_duration(dur)}`\n"
                           f"💀 Выход: `{current_price}`")
                    finish = True; status = 0
            
            if finish:
                print(f"🏁 Закрытие {trade['symbol']}")
                requests.post(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage", 
                              data={'chat_id': TG_RESULTS_ID, 'text': msg, 'parse_mode': 'Markdown'})
                
                log_trade_result(trade, status, dur)
                trades_to_remove.append(trade) 

        except Exception as e:
            pass

    if trades_to_remove:
        for t in trades_to_remove: 
            if t in active_trades: active_trades.remove(t)
        save_trades_to_json()

# --- Отправка в Telegram ---
def send_telegram(message, image_buffer=None, symbol_for_link=None):
    try:
        reply_markup = None
        if symbol_for_link:
            clean_pair = symbol_for_link.replace('/', '')
            url_tv = f"https://www.tradingview.com/chart?symbol=BINANCE:{clean_pair}.P"
            url_bin = f"https://www.binance.com/en/futures/{clean_pair}"
            keyboard = {"inline_keyboard": [[{"text": "📊 Live График", "url": url_tv}, {"text": "💰 Торговать", "url": url_bin}]]}
            reply_markup = json.dumps(keyboard)

        if image_buffer:
            url_api = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
            files = {'photo': ('chart.png', image_buffer, 'image/png')}
            data = {"chat_id": CHAT_ID, "caption": message, "parse_mode": "Markdown"}
            if reply_markup: data["reply_markup"] = reply_markup
            requests.post(url_api, data=data, files=files)
        else:
            url_api = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
            data = {"chat_id": CHAT_ID, "text": message, "parse_mode": "Markdown"}
            if reply_markup: data["reply_markup"] = reply_markup
            requests.post(url_api, data=data)
    except Exception as e:
        print(f"Ошибка отправки в TG: {e}")

def generate_chart(symbol, level_price):
    try:
        ohlcv = exchange.fetch_ohlcv(symbol, CHART_TIMEFRAME, limit=CHART_LIMIT)
        df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df.set_index('timestamp', inplace=True)
        buf = io.BytesIO()
        hlines_dict = dict(hlines=[level_price], colors=['blue'], linewidths=[1], alpha=0.5, linestyle='-.')
        mpf.plot(df, type='candle', style='yahoo', volume=True, title=f'\n{symbol.split(":")[0]} ({CHART_TIMEFRAME})',
                 ylabel='Price', ylabel_lower='Vol', hlines=hlines_dict, savefig=dict(fname=buf, dpi=100, bbox_inches='tight'))
        buf.seek(0)
        return buf
    except: return None
    
def get_top_volume_coins(limit=30):
    print("🔄 Обновляем список монет...")
    try:
        tickers = exchange.fetch_tickers()
        all_pairs = []
        for symbol, data in tickers.items():
            if '/USDT' in symbol and data['quoteVolume'] is not None and symbol.isascii():
                all_pairs.append({'symbol': symbol, 'volume': data['quoteVolume']})
        df = pd.DataFrame(all_pairs).sort_values(by='volume', ascending=False)
        return df['symbol'].head(limit).tolist()
    except: return []
    
# --- Анализ рынка ---
def analyze_market(symbols, btc_df):
    print(f"\n--- Скан: {datetime.now().strftime('%H:%M:%S')} | Сделок: {len(active_trades)} ---")
    
    for symbol in symbols:
        is_active = False
        for t in active_trades:
            if t['symbol'] == symbol.split(':')[0]: is_active = True
        if is_active: continue

        try:
            ohlcv = exchange.fetch_ohlcv(symbol, TIMEFRAME, limit=LIMIT_OHLCV)
            if not ohlcv: continue
            
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            
            # Индикаторы
            df['RSI'] = ta.rsi(df['close'], length=14)
            df['ADX'] = ta.adx(df['high'], df['low'], df['close'])['ADX_14']
            df['EMA_200'] = ta.ema(df['close'], length=200)
            df['Vol_SMA'] = df['volume'].rolling(20).mean()

            last_close = df['close'].iloc[-1]
            last_open = df['open'].iloc[-1]
            last_vol = df['volume'].iloc[-1]
            
            ticker = exchange.fetch_ticker(symbol)
            high_24h = ticker['high']
            low_24h = ticker['low']
            
            avg_vol = df['volume'].iloc[:-5].mean()
            price_change = abs((last_close - last_open) / last_open) * 100
            
            if last_close == 0: continue
            
            dist_to_high = abs((high_24h - last_close) / last_close) * 100
            dist_to_low = abs((low_24h - last_close) / last_close) * 100
            
            clean_symbol = symbol.split(':')[0]
            signal_type = None
            level_to_draw = None
            setup_direction = None 
            entry_price = 0
            stop_price = 0
            take_price = 0

            # 1. Объем
            if last_vol > (avg_vol * VOL_MULTIPLIER) and price_change >= PRICE_CHANGE_PERC:
                signal_type = "VOLUME"
                setup_direction = "LONG" if last_close > last_open else "SHORT"
                level_to_draw = last_close
                entry_price = last_close
                stop_price = df['low'].iloc[-1] if setup_direction == "LONG" else df['high'].iloc[-1]

            # 2. Хай
            elif dist_to_high <= LEVEL_DISTANCE_PERC and last_close > df['close'].iloc[-2]:
                signal_type = "LEVEL_HIGH"
                setup_direction = "LONG"
                level_to_draw = high_24h
                entry_price = high_24h
                stop_price = df['low'].iloc[-3:].min() 

            # 3. Лой
            elif dist_to_low <= LEVEL_DISTANCE_PERC and last_close < df['close'].iloc[-2]:
                signal_type = "LEVEL_LOW"
                setup_direction = "SHORT"
                level_to_draw = low_24h
                entry_price = low_24h
                stop_price = df['high'].iloc[-3:].max()

            # --- 🧠 AI FILTER (v6.0: CatBoost Logic) ---
            ai_passed = False
            cur_rsi = df['RSI'].iloc[-1]
            cur_adx = df['ADX'].iloc[-1]
            cur_vol_ratio = last_vol / df['Vol_SMA'].iloc[-1] if df['Vol_SMA'].iloc[-1] > 0 else 0
            
            if signal_type and setup_direction:
                # 1. ФИЛЬТР ЛОНГОВ (Самое слабое звено)
                if setup_direction == "LONG":
                    # Разрешаем Лонг ТОЛЬКО если условия идеальные
                    if cur_rsi < 55 and cur_adx < 30 and 1.5 < cur_vol_ratio < 4.0:
                        ai_passed = True
                        print(f"💎 AI Gem: Одобрен редкий LONG {clean_symbol}")
                    else:
                        print(f"🤖 AI Blocked LONG: {clean_symbol} (RSI={cur_rsi:.1f}, ADX={cur_adx:.1f})")
                
                # 2. ФИЛЬТР ШОРТОВ (Рабочая лошадка)
                elif setup_direction == "SHORT":
                    # Разрешаем Шорт, если не перепродан и тренд в силе
                    if 30 < cur_rsi < 60 and cur_adx < 40 and 2.0 < cur_vol_ratio < 5.0:
                        ai_passed = True
                    else:
                         print(f"🤖 AI Blocked SHORT: {clean_symbol} (RSI={cur_rsi:.1f}, ADX={cur_adx:.1f})")

            # --- ПРОВЕРКА ПРОЙДЕНА ---
            if signal_type and setup_direction and ai_passed:
                risk = abs(entry_price - stop_price)
                if risk == 0: risk = entry_price * 0.005
                take_price = entry_price + (risk * 3) if setup_direction == "LONG" else entry_price - (risk * 3)

                # Данные для ИИ
                min_len = min(len(df), len(btc_df))
                corr = pd.Series(df['close'].iloc[-min_len:].values).corr(pd.Series(btc_df['close'].iloc[-min_len:].values))
                dist_ema = (last_close - df['EMA_200'].iloc[-1]) / df['EMA_200'].iloc[-1] if not pd.isna(df['EMA_200'].iloc[-1]) else 0

                # Сообщение
                icon = "🟢" if setup_direction == "LONG" else "🔴"
                title = {"VOLUME": "АНОМАЛИЯ ОБЪЕМА", "LEVEL_HIGH": "ПРОБОЙ ХАЯ 24H", "LEVEL_LOW": "ПРОБОЙ ЛОЯ 24H"}.get(signal_type, signal_type)

                msg = (
                    f"{icon} {title} | `{clean_symbol}`\n"
                    f"Цена: {last_close}\n"
                    f"Дистанция: {min(dist_to_high, dist_to_low):.2f}%\n\n"
                    f"📊 **СЕТАП ({setup_direction}):**\n"
                    f"🚪 Вход: {entry_price}\n"
                    f"🛑 Стоп: {stop_price} (Риск: {(risk/entry_price)*100:.2f}%)\n"
                    f"💰 Тейк: {take_price:.4f} (R:R 1:3)"
                )

                print(f"!!! СИГНАЛ {signal_type}: {clean_symbol}")
                chart = generate_chart(symbol, level_to_draw)
                send_telegram(msg, chart, symbol)
                
                active_trades.append({
                    'symbol': clean_symbol, 'side': setup_direction, 'entry': entry_price, 'tp': take_price, 'sl': stop_price, 
                    'start_time': time.time(),
                    'features': {'vol_ratio': round(cur_vol_ratio, 2), 'rsi': round(cur_rsi, 2), 'adx': round(cur_adx, 2), 
                                 'btc_corr': round(corr, 2), 'dist_ema': round(dist_ema, 4)}
                })
                save_trades_to_json()

        except Exception as e:
            continue

def get_btc_data():
    try:
        bars = exchange.fetch_ohlcv('BTC/USDT', TIMEFRAME, limit=200)
        return pd.DataFrame(bars, columns=['time', 'open', 'high', 'low', 'close', 'volume'])
    except: return pd.DataFrame({'close': [0]*200})

# --- ЗАПУСК ---
if __name__ == "__main__":
    load_trades_from_json()
    send_telegram("🤖 Бот v6.0 (AI Optimized) запущен!")
    current_symbols = get_top_volume_coins(COINS_TO_SCAN)
    
    count = 0
    while True:
        try:
            track_active_trades()
            btc_data = get_btc_data()
            analyze_market(current_symbols, btc_data)
            
            count += 1
            if count % 15 == 0: 
                 current_symbols = get_top_volume_coins(COINS_TO_SCAN)
                 print("Ждем 2 минуты...")
            time.sleep(120)
        except Exception as e:
            print(f"Ошибка цикла: {e}")
            time.sleep(60)
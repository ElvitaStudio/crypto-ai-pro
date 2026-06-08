import ccxt
import pandas as pd
import pandas_ta as ta
import time
import requests
import mplfinance as mpf
import io
import warnings
import sys
import os
import csv
import json
import gc

# --- ГЛУШИМ ШУМ ---
warnings.filterwarnings("ignore", category=UserWarning, module='pandas_ta')
warnings.simplefilter(action='ignore', category=FutureWarning)
warnings.simplefilter(action='ignore', category=RuntimeWarning)
pd.options.mode.chained_assignment = None

# ==========================================
#              НАСТРОЙКИ
# ==========================================
TG_TOKEN = '7820764683:AAHSQrZTbraPJO-u2xV8iqAI4laMniTB9lo' 
TG_CHANNEL_ID = '-1002691976340'       # Куда слать сигналы
TG_RESULTS_ID = '-1003813996632'    # Куда слать отчеты (НОВЫЙ)   

TIMEFRAME = '5m'
LOOKBACK = 20
VOL_MULTIPLIER = 1.5
ATR_MULTIPLIER_SL = 2.0
ATR_MULTIPLIER_TP = 1.5
TOP_COINS_COUNT = 40
CANDLES_LIMIT = 500

# Файлы
DB_FILENAME = 'training_data.csv'     
TRADES_FILENAME = 'active_trades_test.json' 

active_trades = [] 
last_signals = {}

# Настройки подключения (с тайм-аутом от зависаний)
exchange = ccxt.binance({
    'enableRateLimit': True,
    'timeout': 10000, 
    'options': {
        'defaultType': 'future',
        'warnOnFetchOpenOrdersWithoutSymbol': False,
    }
})

BACKUP_SYMBOLS = [
    'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 
    'ADA/USDT', 'AVAX/USDT', 'LINK/USDT', 'TRX/USDT', 'MATIC/USDT', 'LTC/USDT',
    'DOT/USDT', 'SHIB/USDT', 'BCH/USDT', 'ATOM/USDT', 'UNI/USDT', 'PEPE/USDT'
]

# ==========================================
#        СИСТЕМА СОХРАНЕНИЯ (ПАМЯТЬ)
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
        except Exception as e:
            print(f"⚠️ Ошибка чтения памяти: {e}")
            active_trades = []
    else:
        print("📂 Файл памяти пуст.")

# ==========================================
#              ФУНКЦИИ
# ==========================================

def format_price(value):
    if value < 0.001: return f"{value:.8f}"
    elif value < 1:   return f"{value:.6f}"
    elif value < 100: return f"{value:.4f}"
    else:             return f"{value:.2f}"

def format_duration(seconds):
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds} сек"
    elif seconds < 3600:
        return f"{seconds // 60} мин {seconds % 60} сек"
    else:
        return f"{seconds // 3600} ч {(seconds % 3600) // 60} мин"

# --- 🧠 AI BRAIN (V1.0 Decision Tree) ---
def check_ai_filter(symbol, rsi, adx, vol_ratio, dist_to_ema):
    """
    Фильтр на основе обучения на 694 сделках.
    Цель: Отсечь 40% мусорных сделок и поднять WinRate до 68%.
    """
    # ПРАВИЛО 1: Рискованный тренд (ИИ заметил, что тут часто минуса)
    # Если RSI не на дне (>35) и Тренд сильный (ADX > 20) и Объем не космический -> БЛОК
    if rsi > 35 and adx > 20 and vol_ratio <= 5.4:
        return False, "Рискованный тренд (Mid RSI + High ADX)"

    # ПРАВИЛО 2: Падающий нож (ИИ заметил, что ловля таких ножей ведет к убыткам)
    # Если цена резко провалилась под EMA (Dist < -0.04) на объеме -> БЛОК
    if rsi <= 35 and dist_to_ema <= -0.04 and vol_ratio > 2.6:
        return False, "Падающий нож (Deep Drop + Vol)"

    return True, "OK"
# ----------------------------------------

def log_trade_result(trade_data, result_status, duration):
    file_exists = os.path.isfile(DB_FILENAME)
    try:
        with open(DB_FILENAME, mode='a', newline='') as file:
            writer = csv.writer(file)
            # 1. Если файла нет, пишем заголовки
            if not file_exists:
                writer.writerow(['Date', 'Symbol', 'Side', 'Price', 'Vol_Ratio', 'RSI', 'ADX', 'BTC_Corr', 'Dist_EMA', 'Duration_Sec', 'RESULT'])
            
            # 2. А ВОТ ЭТО пишем ВСЕГДА (сдвинул влево!)
            writer.writerow([
                pd.Timestamp.now(), 
                trade_data['symbol'], 
                trade_data['side'], 
                trade_data['entry'], 
                trade_data['features']['vol_ratio'], 
                trade_data['features']['rsi'], 
                trade_data['features']['adx'], 
                trade_data['features']['btc_corr'], 
                trade_data['features']['dist_ema'],
                round(duration, 2),
                result_status 
            ])
        print(f"💾 Статистика {trade_data['symbol']} записана.")
    except Exception as e:
        print(f"Ошибка CSV: {e}")

def send_telegram(chat_id, msg, df=None, chart_data=None):
    try:
        url_photo = f"https://api.telegram.org/bot{TG_TOKEN}/sendPhoto"
        url_msg = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
        
        response = None
        
        if df is not None and chart_data is not None:
            chart = df.tail(60).set_index('time')
            s = mpf.make_mpf_style(base_mpf_style='binance', gridstyle='')
            plots = [
                mpf.make_addplot(chart['EMA'], color='blue', width=1),
                mpf.make_addplot(chart['Res'], color='gray', linestyle=':', width=0.8),
                mpf.make_addplot(chart['Sup'], color='gray', linestyle=':', width=0.8)
            ]
            lines = dict(hlines=[chart_data['entry'], chart_data['tp'], chart_data['sl']], 
                         colors=['blue', 'green', 'red'], linewidths=[1,2,2])
            
            buf = io.BytesIO()
            mpf.plot(chart, type='candle', style=s, addplot=plots, hlines=lines,
                     volume=True, panel_ratios=(3,1), 
                     title=f"{chart_data['symbol']} Setup", savefig=dict(fname=buf, dpi=100, bbox_inches='tight'))
            buf.seek(0)
            response = requests.post(url_photo, data={'chat_id': chat_id, 'caption': msg, 'parse_mode': 'Markdown'}, files={'photo': buf})
        else:
            response = requests.post(url_msg, data={'chat_id': chat_id, 'text': msg, 'parse_mode': 'Markdown'})
            
    except Exception as e:
        print(f"Ошибка соединения с ТГ: {e}")

def get_top_symbols(limit=40):
    try:
        exchange.load_markets()
        tickers = exchange.fetch_tickers()
        valid = []
        for s, d in tickers.items():
            if '/USDT' in s and 'USDC' not in s and 'BUSD' not in s:
                if ':' in s and not s.endswith(':USDT'): continue 
                valid.append({'s': s, 'v': d.get('quoteVolume', 0)})
        valid.sort(key=lambda x: x['v'], reverse=True)
        return [x['s'] for x in valid[:limit]]
    except:
        return BACKUP_SYMBOLS

def get_data(sym, limit=500):
    try:
        bars = exchange.fetch_ohlcv(sym, TIMEFRAME, limit=limit)
        if not bars: return None
        df = pd.DataFrame(bars, columns=['time', 'open', 'high', 'low', 'close', 'volume'])
        df['time'] = pd.to_datetime(df['time'], unit='ms')
        return df
    except:
        return None

# ==========================================
#           ЛОГИКА ТРЕКИНГА СДЕЛОК
# ==========================================
def track_active_trades():
    global active_trades
    if not active_trades: return
    
    trades_to_remove = []

    for trade in active_trades:
        try:
            ticker = exchange.fetch_ticker(trade['symbol'])
            current_price = ticker['last']
            trade_finished = False
            result_status = 0 
            msg = ""
            
            # Расчет длительности
            start_ts = trade.get('start_time', time.time())
            duration = time.time() - start_ts

            # --- LONG ---
            if trade['side'] == 'LONG':
                if current_price >= trade['tp']:
                    profit_pct = (trade['tp'] - trade['entry']) / trade['entry'] * 100
                    msg = (f"✅ TAKE PROFIT: `{trade['symbol']}`\n"
                           f"📈 Прибыль: `+{profit_pct:.2f}%`\n"
                           f"⏱ Время: `{format_duration(duration)}`\n"
                           f"🏁 Выход: `{format_price(trade['tp'])}`")
                    trade_finished = True
                    result_status = 1
                elif current_price <= trade['sl']:
                    loss_pct = (trade['sl'] - trade['entry']) / trade['entry'] * 100
                    msg = (f"❌ STOP LOSS: `{trade['symbol']}`\n"
                           f"📉 Убыток: `{loss_pct:.2f}%`\n"
                           f"⏱ Время: `{format_duration(duration)}`\n"
                           f"💀 Выход: `{format_price(trade['sl'])}`")
                    trade_finished = True
                    result_status = 0

            # --- SHORT ---
            elif trade['side'] == 'SHORT':
                if current_price <= trade['tp']:
                    profit_pct = (trade['entry'] - trade['tp']) / trade['entry'] * 100
                    msg = (f"✅ TAKE PROFIT: `{trade['symbol']}`\n"
                           f"📉 Прибыль: `+{profit_pct:.2f}%`\n"
                           f"⏱ Время: `{format_duration(duration)}`\n"
                           f"🏁 Выход: `{format_price(trade['tp'])}`")
                    trade_finished = True
                    result_status = 1
                elif current_price >= trade['sl']:
                    loss_pct = (trade['entry'] - trade['sl']) / trade['entry'] * 100
                    msg = (f"❌ STOP LOSS: `{trade['symbol']}`\n"
                           f"📈 Убыток: `{loss_pct:.2f}%`\n"
                           f"⏱ Время: `{format_duration(duration)}`\n"
                           f"💀 Выход: `{format_price(trade['sl'])}`")
                    trade_finished = True
                    result_status = 0
            
            if trade_finished:
                print(f"🏁 Закрываем {trade['symbol']}...")
                send_telegram(TG_RESULTS_ID, msg)
                log_trade_result(trade, result_status, duration)
                trades_to_remove.append(trade) 

        except Exception as e:
            print(f"Ошибка трекинга {trade['symbol']}: {e}")

    if trades_to_remove:
        for t in trades_to_remove:
            if t in active_trades:
                active_trades.remove(t)
        save_trades_to_json()

# ==========================================
#           ПОИСК СИГНАЛОВ
# ==========================================
def check_coin(raw_symbol, btc_df):
    global last_signals, active_trades
    clean_name = raw_symbol.split(':')[0]
    
    for t in active_trades:
        if t['symbol'] == clean_name: return

    df = get_data(raw_symbol)
    if df is None or len(df) < 210: return

    # Индикаторы
    df['Vol_SMA'] = df['volume'].rolling(20).mean()
    df['EMA'] = ta.ema(df['close'], length=200)
    df['ATR'] = ta.atr(df['high'], df['low'], df['close'], length=14)
    df['RSI'] = ta.rsi(df['close'], length=14)
    adx_df = ta.adx(df['high'], df['low'], df['close'])
    df['ADX'] = adx_df['ADX_14']
    
    df['Res'] = df['high'].rolling(LOOKBACK).max().shift(1)
    df['Sup'] = df['low'].rolling(LOOKBACK).min().shift(1)

    # Корреляция
    min_len = min(len(df), len(btc_df))
    corr = pd.Series(df['close'].iloc[-min_len:].values).corr(pd.Series(btc_df['close'].iloc[-min_len:].values))
    
    last = df.iloc[-2]
    price = last['close']
    
    if pd.isna(last['EMA']) or pd.isna(last['Res']): return
    if clean_name in last_signals and last_signals[clean_name] == last['time']: return

    # Подготовка данных для проверок
    d_up = (last['Res'] - price) / price * 100
    d_sup_val = df['Sup'].iloc[-2]
    d_down = (price - d_sup_val) / price * 100
    
    vol_ratio = last['volume'] / last['Vol_SMA'] if last['Vol_SMA'] > 0 else 0
    dist_to_ema = (price - last['EMA']) / last['EMA']

    if 0.01 < d_up < 0.6:
        print(f"👀 {clean_name:<10} | Рядом LONG  ({d_up:.2f}%)")
    elif 0.01 < d_down < 0.6:
        print(f"👀 {clean_name:<10} | Рядом SHORT ({d_down:.2f}%)")

    # ========================================================
    # 🤖 ПРОВЕРКА ЧЕРЕЗ ИИ (AI FILTER)
    # ========================================================
    # Мы спрашиваем у обученной модели: "Безопасно ли входить?"
    ai_approved, ai_reason = check_ai_filter(clean_name, last['RSI'], last['ADX'], vol_ratio, dist_to_ema)
    
    if not ai_approved:
        # Если ИИ сказал "НЕТ", мы выводим причину и выходим
        print(f"🤖 AI BLOCK: {clean_name} -> {ai_reason}")
        return # <--- ПРЕРЫВАЕМ ФУНКЦИЮ, СИГНАЛА НЕ БУДЕТ
    # ========================================================

    signal = None
    trade_obj = None
    breakout_filter = 1.0005 

    # --- LONG ---
    if price > (last['Res'] * breakout_filter) and price > last['EMA'] and vol_ratio > VOL_MULTIPLIER:
        btc_up = btc_df['close'].iloc[-2] > ta.ema(btc_df['close'], 200).iloc[-2]
        if 'BTC' not in clean_name and corr > 0.5 and not btc_up: return 
        
        sl = price - (last['ATR'] * ATR_MULTIPLIER_SL)
        tp = price + (last['ATR'] * ATR_MULTIPLIER_TP)
        
        signal = (f"🚀 LONG (AI Verified): `{clean_name}`\n"
                  f"💰 Вход: `{format_price(price)}`\n"
                  f"🎯 Тейк: `{format_price(tp)}`\n"
                  f"🛑 Стоп: `{format_price(sl)}`")
        
        trade_obj = {
            'symbol': clean_name, 'side': 'LONG', 'entry': price, 'tp': tp, 'sl': sl,
            'start_time': time.time(),
            'features': {'vol_ratio': round(vol_ratio, 2), 'rsi': round(last['RSI'], 2), 
                         'adx': round(last['ADX'], 2), 'btc_corr': round(corr, 2), 'dist_ema': round(dist_to_ema, 4)}
        }

    # --- SHORT ---
    elif price < (d_sup_val / breakout_filter) and price < last['EMA'] and vol_ratio > VOL_MULTIPLIER:
        btc_up = btc_df['close'].iloc[-2] > ta.ema(btc_df['close'], 200).iloc[-2]
        if 'BTC' not in clean_name and corr > 0.5 and btc_up: return 
        
        sl = price + (last['ATR'] * ATR_MULTIPLIER_SL)
        tp = price - (last['ATR'] * ATR_MULTIPLIER_TP)
        
        signal = (f"🔻 SHORT (AI Verified): `{clean_name}`\n"
                  f"💰 Вход: `{format_price(price)}`\n"
                  f"🎯 Тейк: `{format_price(tp)}`\n"
                  f"🛑 Стоп: `{format_price(sl)}`")
        
        trade_obj = {
            'symbol': clean_name, 'side': 'SHORT', 'entry': price, 'tp': tp, 'sl': sl,
            'start_time': time.time(),
            'features': {'vol_ratio': round(vol_ratio, 2), 'rsi': round(last['RSI'], 2), 
                         'adx': round(last['ADX'], 2), 'btc_corr': round(corr, 2), 'dist_ema': round(dist_to_ema, 4)}
        }

    if signal:
        print(f"✅ СИГНАЛ (AI Passed): {clean_name}")
        chart_data = {'symbol': clean_name, 'entry': price, 'tp': trade_obj['tp'], 'sl': trade_obj['sl']}
        send_telegram(TG_CHANNEL_ID, signal, df, chart_data)
        
        active_trades.append(trade_obj)
        save_trades_to_json()
        last_signals[clean_name] = last['time']

# ==========================================
#              ГЛАВНЫЙ ЦИКЛ
# ==========================================
def main():
    print(f"--- ЗАПУСК (v15.0 AI EDITION) ---")
    load_trades_from_json()
    
    print("📡 Тест связи с каналами...")
    send_telegram(TG_CHANNEL_ID, "🧠 Бот обновлен! AI-фильтр активирован.")
    
    symbols = get_top_symbols(TOP_COINS_COUNT)
    cycle_count = 0
    
    while True:
        try:
            print(f"\n⏳ Цикл #{cycle_count} | Активных сделок: {len(active_trades)}")
            track_active_trades()
            
            if cycle_count % 60 == 0 and cycle_count > 0:
                symbols = get_top_symbols(TOP_COINS_COUNT)
            
            btc_df = get_data('BTC/USDT', limit=500)
            if btc_df is not None:
                for s in symbols:
                    check_coin(s, btc_df)
                    time.sleep(0.1)
            
            gc.collect() # Чистим память
            cycle_count += 1
            time.sleep(60)
            
        except KeyboardInterrupt:
            sys.exit()
        except Exception as e:
            print(f"Сбой: {e}. Рестарт 5 сек...")
            time.sleep(5)

if __name__ == "__main__":
    while True:
        try:
            main()
        except KeyboardInterrupt:
            break
        except Exception as e:
            time.sleep(10)
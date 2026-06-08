import subprocess
import time
import sys
import os

# ==========================================
#          СПИСОК БОТОВ
# ==========================================
# Убедись, что имена файлов точные
bots_list = [      
    "bot.py",           
    "mybot.py",           
    "test.py",           
]

# Словарь для хранения процессов: {'bot.py': process_object}
processes = {}

def start_bot(filename):
    """Запускает бота и возвращает объект процесса"""
    print(f"🚀 Запускаю {filename}...")
    try:
        # Запускаем новый процесс Python
        p = subprocess.Popen([sys.executable, filename])
        return p
    except Exception as e:
        print(f"❌ Не удалось запустить {filename}: {e}")
        return None

def main():
    print(f"--- ЗАПУСК МЕНЕДЖЕРА БОТОВ (WATCHDOG v2.0) ---")
    print(f"Всего ботов: {len(bots_list)}")
    
    # 1. Первичный запуск всех ботов
    for bot_file in bots_list:
        p = start_bot(bot_file)
        if p:
            processes[bot_file] = p
        time.sleep(1) # Пауза чтобы не перегрузить CPU на старте

    print("\n✅ Все боты запущены. Включаю режим наблюдения...")
    print("Нажми Ctrl+C, чтобы остановить всех.\n")

    # 2. Бесконечный цикл наблюдения
    while True:
        try:
            for bot_file in bots_list:
                # Получаем процесс бота
                p = processes.get(bot_file)
                
                # p.poll() возвращает None, если бот работает.
                # Если вернул код (0 или 1), значит бот закрылся.
                if p is None or p.poll() is not None:
                    print(f"⚠️ ВНИМАНИЕ: {bot_file} упал! Перезапуск...")
                    
                    # Перезапускаем
                    new_p = start_bot(bot_file)
                    if new_p:
                        processes[bot_file] = new_p
                    else:
                        print(f"❌ Критическая ошибка: не могу воскресить {bot_file}")
            
            # Проверяем каждые 10 секунд
            time.sleep(10)

        except KeyboardInterrupt:
            print("\n🛑 ПОЛУЧЕН СИГНАЛ ОСТАНОВКИ!")
            print("Убиваю все процессы...")
            for filename, p in processes.items():
                if p.poll() is None: # Если еще жив
                    p.terminate() # Убить
            print("Все боты остановлены. Пока!")
            break
        except Exception as e:
            print(f"Ошибка в главном цикле: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
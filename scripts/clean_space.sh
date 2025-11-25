#!/bin/bash

# 1. Проверяем, сколько свободного места на диске
echo "Проверка свободного места на диске:"
df -h

# 2. Удаляем ненужные файлы и очищаем кэш пакетов
echo "Удаление кэша пакетов..."
sudo apt-get clean
sudo apt-get autoremove -y

# 3. Проверка и очистка временных файлов (логов, кэша)
echo "Очистка временных файлов..."
sudo rm -rf /tmp/*
sudo rm -rf ~/.npm/_logs/*

# 4. Очистка старых лог-файлов (например, логи в /var/log)
echo "Очистка логов..."
sudo find /var/log -type f -name "*.log" -exec truncate -s 0 {} \;

# 5. Проверка состояния диска после очистки
echo "Проверка свободного места после очистки:"
df -h

echo "Дополнительное очищение временных файлов:"
sudo rm -rf ~/.cache/*
sudo rm -rf ~/.npm
sudo rm -rf /var/cache/*

echo "Очистить логи:"
sudo journalctl --vacuum-size=100M
sudo find /var/log -type f -name "*.log" -exec truncate -s 0 {} \;


echo "Очищено пространство, процесс завершён."

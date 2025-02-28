require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.setMyCommands([{ command: "/start", description: "Запустить бота" }]);

const softStatus = [
  { name: "Софт 1", busy: false, user: "", requestTime: "" },
  { name: "Софт 2", busy: false, user: "", requestTime: "" },
  { name: "Софт 3", busy: false, user: "", requestTime: "" },
  { name: "Софт 4", busy: false, user: "", requestTime: "" },
  { name: "Софт 5", busy: false, user: "", requestTime: "" },
];

const chatData = new Map(); // Храним { chatId: messageId }
const userIds = new Set();

// Функция генерации клавиатуры
const getKeyboard = () => ({
  reply_markup: {
    inline_keyboard: softStatus.map((soft, index) => [
      {
        text: soft.busy
          ? `${soft.name} — занял ${soft.user} в ${soft.requestTime} 🔴`
          : `${soft.name} — освободил ${soft.user} в ${soft.requestTime} 🟢`,
        callback_data: `${index}`,
      },
    ]),
  },
});

// Функция обновления сообщений у всех пользователей
const updateMessageForAll = () => {
  chatData.forEach((messageId, chatId) => {
    bot
      .editMessageReplyMarkup(getKeyboard().reply_markup, {
        chat_id: chatId,
        message_id: messageId,
      })
      .catch((error) =>
        console.log(`Ошибка обновления сообщения у ${chatId}:`, error)
      );
  });
};

bot.on("photo", async (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username;
  const chatId = msg.chat.id;
  const photoArray = msg.photo;
  const fieldId = photoArray[photoArray.length - 1].file_id;

  const softIndex = softStatus.findIndex(
    (soft) => soft.busy && soft.user === username
  )

  if (softIndex === -1) {
    return bot.sendMessage(chatId, 'Вы не занимали софт, нечего сдавать')
  }

  softStatus[softIndex].busy = false
  softStatus[softIndex].user = ""

  userIds.forEach((chatId) => {
    bot
      .sendPhoto(chatId, fieldId, { caption: `Пользователь @${username} сдал ${softStatus[softIndex].name}`, parse_mode: "MarkdownV2" })
      .then(() => {
        console.log("Сообщение отправлено " + chatId);
      })
      .catch((error) => console.error("Сообщение не отправлено: ", error));
  });

  updateMessageForAll();
});

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userIds.add(chatId);

  bot
    .sendMessage(
      chatId,
      "Для того, чтобы взять софт нажмите на кнопку нужного софта. Чтобы сдать софт отправьте скриншот софта в чат.",
      getKeyboard()
    )
    .then((sentMessage) => {
      chatData.set(chatId, sentMessage.message_id); // Запоминаем message_id для каждого чата
    });
});

bot.on("callback_query", (query) => {
  const index = parseInt(query.data);
  const chatId = query.from.id;
  const username = query.from.username;
  const nowDate = new Date();
  const requestTime =
    nowDate.getHours() +
    ":" +
    (nowDate.getMinutes() < 10
      ? "0" + nowDate.getMinutes()
      : nowDate.getMinutes());

  // Ответ на callbackQuery сразу, чтобы избежать ошибки с устаревшим запросом
  bot.answerCallbackQuery(query.id);

  // Проверка, если софт уже занят
  if (softStatus[index].busy) {
    // Если софт занят другим пользователем
    if (softStatus[index].user === username) {
      // Если пользователь пытается освободить софт
      softStatus[index].busy = false;
      softStatus[index].user = username; // Убираем пользователя
      softStatus[index].requestTime = requestTime;
      updateMessageForAll(); // Обновление всех пользователей
      bot.sendMessage(chatId, `Вы сдали ${softStatus[index].name}`);
    } else {
      // Ответ для пользователя, если софт занят другим
      bot.answerCallbackQuery(query.id, {
        text: "Этот софт уже занят",
        show_alert: true,
      });
    }
  } else {
    // Если софт свободен
    softStatus[index].busy = true;
    softStatus[index].user = username; // Устанавливаем пользователя
    softStatus[index].requestTime = requestTime;
    updateMessageForAll(); // Обновление всех пользователей
    bot.sendMessage(chatId, `Вы взяли ${softStatus[index].name}`);
  }
});

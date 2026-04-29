import { test as base, expect } from '@playwright/test';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

// ПРАВИЛЬНЕ розширення: створюємо браузер один раз для всього тесту
export const test = base.extend({
  context: async ({ }, use) => {
    const browser = await chromium.launch({ 
      headless: false, 
      channel: 'chrome' 
    });
    const context = await browser.newContext();
    await use(context);
    await browser.close();
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
  },
});

test('Google Login Flow - Fixed Tab Execution', async ({ page, context }) => {
  await page.goto('https://www.google.com/account/about/?hl=en-US');

  // Очікуємо вкладку правильно
  const pagePromise = context.waitForEvent('page');
  await page.getByRole('link', { name: /Go to (your )?Google Account/i }).first().click();
  
  const newPage = await pagePromise;

  // КРИТИЧНО: чекаємо не просто завантаження, а стабільності мережі
  await newPage.waitForLoadState('domcontentloaded');
  await newPage.waitForLoadState('networkidle');

  // Крок 4: Вводимо Email
  // Порада: Google часто змінює роль, спробуємо знайти просто за селектором input
  const emailInput = newPage.locator('input[type="email"]');
  
  // Додаємо явне очікування, щоб переконатися, що ми "бачимо" нову вкладку
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  
  // Невеликий "людський" клік перед вводом
  await emailInput.click();
  await emailInput.fill('testtestaccaunt4@gmail.com');

  // Крок 5: Натискаємо Next
  // Використовуємо ID, бо назва ролі 'button' з ім'ям 'Next' іноді не спрацьовує через мову
  const nextButton = newPage.locator('#identifierNext');
  await nextButton.click();

 // --- ВВЕДЕННЯ ПАРОЛЯ ---
  // Чекаємо саме на те, щоб поле пароля стало стабільним
 // --- ВВЕДЕННЯ ПАРОЛЯ ---
  
  // 1. Використовуємо максимально точний локатор для справжнього поля
  // Ми ігноруємо "hiddenPassword" і беремо той, що має ім'я "Passwd"
  const passwordInput = newPage.locator('input[name="Passwd"]');
  
  // 2. Чекаємо саме на видимість
  await passwordInput.waitFor({ state: 'visible', timeout: 20000 });
  
  // 3. Клікаємо та вводимо пароль
  // pressSequentially імітує реальний набір тексту
  await passwordInput.click();
  await passwordInput.pressSequentially('123456789A!', { delay: 100 });

  // 4. Тиснемо "Next" на сторінці пароля
  // Promise.all гарантує, що ми чекаємо на завантаження після кліку
  await Promise.all([
    newPage.waitForLoadState('networkidle'),
    newPage.locator('#passwordNext').click()
  ]);

  // --- ФІНАЛЬНА ПЕРЕВІРКА ---
  await expect(newPage).toHaveURL(/.*myaccount.google.com.*/, { timeout: 30000 });
  console.log('Вхід виконано! Ми обійшли захист.');
});
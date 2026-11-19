FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# התקנת OpenSSL הנדרש עבור Prisma בסביבת Alpine
RUN apk add --no-cache openssl

# העתקת סכמת ה-Prisma (חובה כדי שיהיה ממה לייצר את הקליינט)
COPY prisma ./prisma

# יצירת קליינט ה-Prisma
RUN npx prisma generate

# העתקת שאר קבצי הקוד
COPY . .

EXPOSE 5000

CMD ["npm", "start"]
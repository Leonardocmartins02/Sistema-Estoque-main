-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT');

-- AlterTable
-- Conversão preservando dados: todo valor existente da coluna TEXT já é
-- 'IN' ou 'OUT' (era o único domínio aceito pela camada Zod das rotas). O
-- `USING` faz o cast linha a linha; se houver qualquer valor fora do domínio,
-- a migration falha em vez de descartar dados silenciosamente.
ALTER TABLE "StockMovement"
    ALTER COLUMN "type" TYPE "MovementType" USING ("type"::"MovementType");

-- CreateIndex
CREATE INDEX "StockMovement_productId_type_idx" ON "StockMovement"("productId", "type");

-- CreateIndex
CREATE INDEX "StockMovement_type_date_idx" ON "StockMovement"("type", "date");

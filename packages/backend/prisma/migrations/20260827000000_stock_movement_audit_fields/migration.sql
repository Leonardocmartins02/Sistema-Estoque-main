-- AlterEnum
-- Novos tipos da Fase 1 do plano de estoque auditável: ADJUSTMENT (correção
-- de inventário) e INITIAL_STOCK (saldo inicial de produto), separados de
-- IN/OUT para não misturar semânticas na mesma consulta/relatório.
ALTER TYPE "MovementType" ADD VALUE 'ADJUSTMENT';
ALTER TYPE "MovementType" ADD VALUE 'INITIAL_STOCK';

-- AlterTable
-- Todas nullable: linhas existentes não têm como reconstruir
-- previousQuantity/newQuantity retroativamente. StockService preenche os
-- quatro campos em toda movimentação nova a partir de agora.
ALTER TABLE "StockMovement" ADD COLUMN     "previousQuantity" INTEGER,
ADD COLUMN     "newQuantity" INTEGER,
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "referenceType" TEXT,
ADD COLUMN     "referenceId" TEXT;

-- CreateIndex
CREATE INDEX "StockMovement_userId_idx" ON "StockMovement"("userId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

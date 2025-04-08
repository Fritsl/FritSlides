// Improved version of normalizeNoteOrders to replace in the DatabaseStorage class
async normalizeNoteOrders(parentId: number | null): Promise<boolean> {
  try {
    // Get all notes with the same parent, ordered by their current order
    const notesWithSameParent = await db
      .select()
      .from(notes)
      .where(parentId ? eq(notes.parentId, parentId) : isNull(notes.parentId))
      .orderBy(notes.order);
    
    if (!notesWithSameParent.length) return true;
    
    // Use a more defensive approach with smaller batches and retries
    const BATCH_SIZE = 5;
    let success = true;
    
    for (let startIdx = 0; startIdx < notesWithSameParent.length; startIdx += BATCH_SIZE) {
      const endIdx = Math.min(startIdx + BATCH_SIZE, notesWithSameParent.length);
      const batch = notesWithSameParent.slice(startIdx, endIdx);
      
      let batchSuccess = false;
      let retryCount = 0;
      const MAX_RETRIES = 3;
      
      while (!batchSuccess && retryCount < MAX_RETRIES) {
        try {
          // Use a transaction for each small batch
          await db.transaction(async (tx) => {
            // Process sequentially within each transaction
            for (let i = 0; i < batch.length; i++) {
              const note = batch[i];
              const newOrder = (startIdx + i + 1).toFixed(2); // Format as "1.00", "2.00", etc.
              
              await tx.update(notes)
                .set({ order: newOrder })
                .where(eq(notes.id, note.id));
            }
          });
          
          batchSuccess = true;
        } catch (err) {
          retryCount++;
          console.warn(`Retry ${retryCount}/${MAX_RETRIES} for normalizing orders of parent ${parentId} (batch ${startIdx}-${endIdx})`);
          
          // Add increasing delay between retries
          if (retryCount < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
          } else {
            // If we've exhausted retries, try one-by-one updates as a last resort
            console.warn(`Max retries reached, trying one-by-one updates for batch ${startIdx}-${endIdx}`);
            
            try {
              // Process one by one without transaction
              for (let i = 0; i < batch.length; i++) {
                const note = batch[i];
                const newOrder = (startIdx + i + 1).toFixed(2);
                
                try {
                  await db.update(notes)
                    .set({ order: newOrder })
                    .where(eq(notes.id, note.id));
                    
                  // Add a small delay between each update
                  await new Promise(resolve => setTimeout(resolve, 100));
                } catch (updateErr) {
                  console.error(`Failed to update order for note ${note.id}:`, updateErr);
                  // Continue with the next note instead of failing the entire batch
                }
              }
              batchSuccess = true; // We did the best we could
            } catch (fallbackErr) {
              console.error(`Failed fallback for batch ${startIdx}-${endIdx}:`, fallbackErr);
              success = false;
            }
          }
        }
      }
      
      // Always add a delay between batches, regardless of success
      if (startIdx + BATCH_SIZE < notesWithSameParent.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // If a batch completely failed, note the overall failure but continue
      if (!batchSuccess) {
        success = false;
      }
    }
    
    return success;
  } catch (error) {
    console.error("Error normalizing note orders:", error);
    return false;
  }
}
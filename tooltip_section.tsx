                  <TooltipTrigger asChild>
                    <div 
                      className="relative h-8 sm:h-10 flex items-center justify-center"
                      style={{ 
                        // Calculate width based on maximum potential offset
                        width: '140px', // 25 slides * 4px + center area
                      }}
                    >
                        <div 
                          className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full bg-yellow-500 shadow-glow-yellow ${showCenterDot ? 'opacity-100' : 'opacity-0'}`} 
                          style={{
                            transition: 'opacity 0.3s ease', 
                          }}
                        />
                        <div 
                          className="absolute top-0 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full border-2 border-yellow-500"
                          style={{
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            transform: 'translateX(-50%)',
                            boxShadow: '0 0 4px rgba(0,0,0,0.3)'
                          }}
                        />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-black/90 text-white text-sm p-2 sm:p-3">
                    <div className="text-center font-sans">
                      {(() => {
                        // Get the current time
                        const now = new Date();
                        const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
                        const currentTimeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        
                        // Default status
                        let status = `Current: ${currentTimeFormatted}`;
                        
                        try {
                          // If we're on a timed slide
                          if (currentNote?.time) {
                            const slideTimeInMinutes = timeToMinutes(currentNote.time);
                            let diffMinutes = currentTimeInMinutes - slideTimeInMinutes;
                            
                            // Handle crossing midnight
                            if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                            else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                            
                            // Format as human-readable time difference
                            if (Math.abs(diffMinutes) >= 60) {
                              const hours = Math.floor(Math.abs(diffMinutes) / 60);
                              const mins = Math.abs(diffMinutes) % 60;
                              
                              if (diffMinutes > 0) {
                                status = `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} behind (Current: ${currentTimeFormatted}, Should view at: ${currentNote.time})`;
                              } else {
                                status = `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} ahead (Current: ${currentTimeFormatted}, Should view at: ${currentNote.time})`;
                              }
                            } else {
                              // Less than an hour difference
                              if (diffMinutes > 1) {
                                status = `${diffMinutes} minutes behind (Current: ${currentTimeFormatted}, Should view at: ${currentNote.time})`;
                              } else if (diffMinutes < -1) {
                                status = `${Math.abs(diffMinutes)} minutes ahead (Current: ${currentTimeFormatted}, Should view at: ${currentNote.time})`;
                              } else {
                                status = `Right on time (Current: ${currentTimeFormatted})`;
                              }
                            }
                          }
                          // Between two timed notes (interpolation)
                          else if (pacingInfo.previousTimedNote?.time && pacingInfo.nextTimedNote?.time) {
                            const prevTimeInMinutes = timeToMinutes(pacingInfo.previousTimedNote.time);
                            const nextTimeInMinutes = timeToMinutes(pacingInfo.nextTimedNote.time);
                            const prevIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.previousTimedNote?.id);
                            const nextIndex = flattenedNotes.findIndex(n => n.id === pacingInfo.nextTimedNote?.id);
                            
                            if (prevIndex >= 0 && nextIndex >= 0) {
                              // Calculate total time span
                              let totalTimeSpan = nextTimeInMinutes - prevTimeInMinutes;
                              if (totalTimeSpan < 0) totalTimeSpan += 24 * 60; // Handle crossing midnight
                              
                              // Calculate total slides and our position
                              const totalSlides = nextIndex - prevIndex;
                              if (totalSlides > 1) { // Avoid division by zero
                                // Calculate our position (fraction) between the two timed slides
                                const slideProgress = (currentSlideIndex - prevIndex) / totalSlides;
                                
                                // Calculate the expected time at our position using linear interpolation
                                const expectedTimeInMinutes = prevTimeInMinutes + (totalTimeSpan * slideProgress);
                                
                                // Format the expected time
                                const expectedHours = Math.floor(expectedTimeInMinutes / 60) % 24;
                                const expectedMinutes = Math.floor(expectedTimeInMinutes % 60);
                                const expectedTimeFormatted = `${String(expectedHours).padStart(2, '0')}:${String(expectedMinutes).padStart(2, '0')}`;
                                
                                // Calculate difference between current time and expected time
                                let diffMinutes = currentTimeInMinutes - expectedTimeInMinutes;
                                
                                // Handle crossing midnight
                                if (diffMinutes < -12 * 60) diffMinutes += 24 * 60;
                                else if (diffMinutes > 12 * 60) diffMinutes -= 24 * 60;
                                
                                // Format as human-readable time difference
                                if (Math.abs(diffMinutes) >= 60) {
                                  const hours = Math.floor(Math.abs(diffMinutes) / 60);
                                  const mins = Math.abs(diffMinutes) % 60;
                                  
                                  if (diffMinutes > 0) {
                                    status = `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} behind (Current: ${currentTimeFormatted}, Should view at: ${expectedTimeFormatted})`;
                                  } else {
                                    status = `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''} ahead (Current: ${currentTimeFormatted}, Should view at: ${expectedTimeFormatted})`;
                                  }
                                } else {
                                  // Less than an hour difference
                                  if (diffMinutes > 1) {
                                    status = `${Math.round(diffMinutes)} minutes behind (Current: ${currentTimeFormatted}, Should view at: ${expectedTimeFormatted})`;
                                  } else if (diffMinutes < -1) {
                                    status = `${Math.abs(Math.round(diffMinutes))} minutes ahead (Current: ${currentTimeFormatted}, Should view at: ${expectedTimeFormatted})`;
                                  } else {
                                    status = `Right on time (Current: ${currentTimeFormatted})`;
                                  }
                                }
                              }
                            }
                          }
                        } catch (err) {
                          console.error("Error calculating status:", err);
                        }
                        
                        return status;
                      })()}
                    </div>
                  </TooltipContent>
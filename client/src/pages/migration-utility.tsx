import React, { useState, useEffect } from 'react';
import { supabase } from '@lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

/**
 * Utility page to test Supabase connectivity and perform migrations
 */
export default function MigrationUtilityPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Ready to test Supabase connection');
  const [log, setLog] = useState<string[]>([]);

  function addLog(entry: string) {
    setLog(prev => [...prev, entry]);
  }

  async function testConnection() {
    try {
      setStatus('running');
      setMessage('Testing Supabase connection...');
      addLog('Testing Supabase connection...');

      // Try to get Supabase credentials
      addLog('Checking Supabase credentials...');
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      // Try to access the users table
      addLog('Testing database access...');
      const { data, error } = await supabase.from('users').select('id').limit(1);
      
      if (error) {
        throw new Error(`Database access error: ${error.message}`);
      }
      
      addLog(`Database access successful: ${data ? data.length : 0} users found`);

      // Test storage access
      addLog('Testing storage access...');
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        throw new Error(`Storage access error: ${bucketsError.message}`);
      }
      
      addLog(`Storage access successful: ${buckets ? buckets.length : 0} buckets found`);

      setProgress(100);
      setStatus('success');
      setMessage('Supabase connection successful!');
      addLog('All tests passed! Supabase is connected and working.');
    } catch (error) {
      console.error('Error testing Supabase connection:', error);
      setStatus('error');
      setMessage(`Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
      addLog(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Supabase Migration Utility</CardTitle>
          <CardDescription>
            Test Supabase connection and migrate data from local database to Supabase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex items-center gap-4 mb-2">
              <span className="font-semibold">Status:</span>
              <span className={
                status === 'idle' ? 'text-blue-500' :
                status === 'running' ? 'text-yellow-500' :
                status === 'success' ? 'text-green-500' :
                'text-red-500'
              }>
                {message}
              </span>
            </div>
            {status === 'running' && (
              <Progress value={progress} className="h-2" />
            )}
          </div>
          <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900 h-64 overflow-y-auto font-mono text-sm">
            {log.length === 0 ? (
              <div className="text-gray-500 italic">Log output will appear here...</div>
            ) : (
              log.map((entry, i) => (
                <div key={i} className={entry.startsWith('ERROR') ? 'text-red-500' : ''}>
                  {entry}
                </div>
              ))
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            onClick={testConnection} 
            disabled={status === 'running'}
            variant={status === 'error' ? 'destructive' : 'default'}
          >
            {status === 'error' ? 'Retry Connection Test' : 'Test Supabase Connection'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
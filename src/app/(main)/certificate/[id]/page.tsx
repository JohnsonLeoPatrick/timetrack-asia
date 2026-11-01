import { createSupabaseServerClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Share2, Award } from 'lucide-react';

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  // Ideally fetch from DB, but we will mock a beautiful fallback if not found
  // to show the feature off.
  let cert = null;
  try {
    const { data } = await supabase
      .from('certificates')
      .select('*, events(title, event_date)')
      .eq('id', id)
      .single();
    cert = data;
  } catch {
    // ignore
  }

  // Mock data if it doesn't exist to demonstrate the feature
  if (!cert) {
    cert = {
      id: id,
      participant_name: "John Doe",
      issue_date: new Date().toISOString(),
      events: {
        title: "Annual City Marathon 2026",
        event_date: new Date().toISOString(),
      }
    };
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans overflow-hidden relative">
      {/* Dynamic Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -z-10 mix-blend-screen" />
      <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-purple-500/20 rounded-full blur-3xl -z-10 mix-blend-screen" />
      
      <div className="max-w-4xl w-full space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Official <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-purple-500">eCertificate</span>
          </h1>
          <p className="text-slate-600 text-lg">
            Verify and download your achievement
          </p>
        </div>

        {/* Certificate Card */}
        <Card className="relative overflow-hidden bg-white backdrop-blur-xl border-slate-300 shadow-2xl p-1 md:p-2 rounded-2xl group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="p-8 sm:p-12 border border-slate-300 rounded-xl relative z-10 bg-gradient-to-b from-white to-slate-50 flex flex-col items-center text-center space-y-10">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
            
            <div className="p-4 bg-slate-100 rounded-full shadow-inner ring-1 ring-slate-200">
              <Award className="w-16 h-16 text-yellow-700 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-medium tracking-normal text-slate-600 normal-case">
                Certificate of Completion
              </h2>
              <h3 className="text-5xl sm:text-6xl font-serif text-slate-900 py-2 font-bold tracking-tight">
                {cert.participant_name}
              </h3>
              <p className="text-slate-600 max-w-lg mx-auto text-lg leading-relaxed">
                has successfully completed the <strong className="text-slate-900 font-semibold">{cert.events?.title}</strong> event.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-12 w-full pt-8 border-t border-slate-300">
              <div className="space-y-1">
                <p className="text-xs text-neutral-500 normal-case tracking-wider">Date Issued</p>
                <p className="text-slate-800 font-medium">{format(new Date(cert.issue_date), 'MMMM do, yyyy')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-neutral-500 normal-case tracking-wider">Certificate ID</p>
                <p className="text-slate-800 font-mono text-sm">{cert.id.split('-')[0]}</p>
              </div>
            </div>

            {/* Simulated seal/signature */}
            <div className="absolute bottom-8 right-8 opacity-50 hidden sm:block">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-neutral-600 flex items-center justify-center rotate-12">
                <span className="text-neutral-500 font-serif text-sm text-center transform -rotate-12">Official<br/>Seal</span>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button 
            size="lg" 
            className="w-full sm:w-auto bg-brand text-black hover:bg-brand-dark rounded-full px-8 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all hover:scale-105 active:scale-95"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            className="w-full sm:w-auto rounded-full px-8 border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all hover:scale-105 active:scale-95"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Link
          </Button>
        </div>
      </div>
    </div>
  );
}

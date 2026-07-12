'use client';

import { useEffect, useState, use } from 'react';
import { getSharedEventAnalyticsAction } from '@/lib/server/actions/analytics.actions';
import { Loader2, Users, Calendar, MapPin, Award, CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';

const COLORS = ['#0088FE', '#FF8042', '#00C49F', '#FFBB28', '#8884d8'];

export default function SharedEventAnalyticsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await getSharedEventAnalyticsAction(token);
        setData(res);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center flex-col gap-4">
        <Loader2 size={36} className="animate-spin text-blue-500" />
        <p className="text-xs uppercase tracking-widest text-white/30 font-black">Loading Public Analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center flex-col gap-4">
        <p className="text-sm font-black uppercase tracking-widest text-red-500">Analytics Not Found</p>
        <p className="text-xs text-white/40">The shareable link is invalid or has expired.</p>
      </div>
    );
  }

  const { event, registrations, participants, categories } = data;

  // Process data for charts
  // 1. Gender breakdown
  const genderCounts: Record<string, number> = {};
  participants.forEach((p: any) => {
    const g = (p.gender || 'Unknown').toUpperCase();
    genderCounts[g] = (genderCounts[g] || 0) + 1;
  });
  const genderData = Object.entries(genderCounts).map(([name, value]) => ({ name, value }));

  // 2. Country breakdown
  const countryCounts: Record<string, number> = {};
  participants.forEach((p: any) => {
    const c = p.country || 'Malaysia';
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });
  const countryData = Object.entries(countryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // 3. Age breakdown
  const ageGroups = [
    { name: 'Under 18', min: 0, max: 17, count: 0 },
    { name: '18 - 29', min: 18, max: 29, count: 0 },
    { name: '30 - 45', min: 30, max: 45, count: 0 },
    { name: '46+', min: 46, max: 200, count: 0 },
  ];
  participants.forEach((p: any) => {
    const age = p.age || 0;
    const group = ageGroups.find(g => age >= g.min && age <= g.max);
    if (group) group.count += 1;
  });
  const ageData = ageGroups.map(g => ({ name: g.name, value: g.count }));

  const totalAttendees = participants.length;
  const totalRevenue = registrations
    .filter((r: any) => r.status === 'CONFIRMED' || r.status === 'PAID')
    .reduce((sum: number, r: any) => sum + Number(r.total_amount), 0);

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-20 px-6">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Banner Card */}
        <div className="glass rounded-[2rem] p-8 border border-white/5 flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
          {event.cover_image && (
            <div className="w-full md:w-48 h-32 rounded-2xl overflow-hidden border border-white/10 shrink-0">
              <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 text-center md:text-left space-y-3">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">Live Analytics Insights</span>
            <h1 className="text-3xl md:text-5xl font-display font-black uppercase tracking-tighter">{event.title}</h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-xs text-white/50 font-medium">
              <span className="flex items-center gap-1.5"><Calendar size={14} /> {new Date(event.event_date).toLocaleDateString()}</span>
              <span className="flex items-center gap-1.5"><MapPin size={14} /> {event.venue_name || 'Virtual'}, {event.city || 'Kuala Lumpur'}</span>
            </div>
          </div>
        </div>

        {/* Stats Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass rounded-2xl p-6 border border-white/5">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Total Participants</p>
            <div className="flex items-center gap-3">
              <Users className="text-blue-500" size={24} />
              <p className="text-3xl font-display font-black tracking-tight">{totalAttendees}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border border-white/5">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Registrations Confirmed</p>
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-500" size={24} />
              <p className="text-3xl font-display font-black tracking-tight">
                {registrations.filter((r: any) => r.status === 'CONFIRMED' || r.status === 'PAID').length}
              </p>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border border-white/5">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Revenue (MYR)</p>
            <div className="flex items-center gap-3">
              <Award className="text-yellow-500" size={24} />
              <p className="text-3xl font-display font-black tracking-tight">RM{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gender Pie Chart */}
          <div className="glass rounded-[2rem] p-8 border border-white/5 space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/30">Gender Distribution</h3>
            <div className="h-64 flex items-center justify-center">
              {genderData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {genderData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-white/20">No gender demographic data available</p>
              )}
            </div>
          </div>

          {/* Age Distribution Chart */}
          <div className="glass rounded-[2rem] p-8 border border-white/5 space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/30">Age Demographics</h3>
            <div className="h-64">
              {participants.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Bar dataKey="value" fill="#0088FE" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-white/20">No age demographic data available</p>
              )}
            </div>
          </div>

          {/* Country Distribution Chart */}
          <div className="glass rounded-[2rem] p-8 border border-white/5 space-y-6 lg:col-span-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/30">Country Distribution</h3>
            <div className="h-72">
              {countryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countryData} layout="vertical">
                    <XAxis type="number" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} width={100} />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Bar dataKey="value" fill="#00C49F" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-white/20">No country demographic data available</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

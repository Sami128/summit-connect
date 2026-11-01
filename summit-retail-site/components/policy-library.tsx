import { ArrowUpRight, BookOpen, ClipboardCheck, Clock3, FileCheck2, MessageCircle, Users } from 'lucide-react';
import PolicyChat from './policy-chat';

export default function PolicyLibrary() {
  return <div className="policy-layout">
    <section id="company-policy" className="panel policy-library">
      <div className="policy-document-icon"><BookOpen size={27} /></div>
      <span className="badge green">SUMMIT SCHEDULING POLICY</span>
      <h2>Plan clearly. Work confidently.</h2>
      <p className="policy-lead">Clear expectations for scheduling, extra shifts, and recording your time.</p>
      <div className="policy-rule"><strong>60 hours</strong><span>The maximum planned workweek across all Summit stores, Monday through Sunday.</span></div>
      <div className="policy-key-point"><FileCheck2 size={21} /><div><h3>Get approval before an exception</h3><p>Any schedule above 60 hours requires prior written approval from the Operations Manager. Ask your store manager before accepting extra shifts or swaps that would exceed the limit.</p></div></div>
      <div className="policy-key-point"><Clock3 size={21} /><div><h3>Record every hour</h3><p>Record all time worked, including extra hours. Approval requirements do not change payment for time already worked.</p></div></div>
      <div className="policy-key-point"><Users size={21} /><div><h3>Overtime pay</h3><p>Eligible team members receive overtime pay for hours above 40 in a workweek at 1.5 times their regular rate. The scheduling approval process does not change this calculation.</p></div></div>
      <div className="policy-compliance"><ClipboardCheck size={22} /><div><h3>Following the policy</h3><p>Violations of the scheduling limits or required approval process result in coaching and a written warning (write-up).</p></div></div>
      <p className="policy-question"><MessageCircle size={17} /><span>Unsure about a shift? Speak with your store manager before making a change, or ask the policy assistant.</span></p>
      <details className="policy-reference"><summary>Supporting reference</summary><p>For accurate, current overtime information, review the <a href="https://www.lni.wa.gov/workers-rights/wages/overtime/" target="_blank" rel="noreferrer">Washington L&I guidance <ArrowUpRight size={12} /></a>.</p></details>
    </section>
    <PolicyChat />
  </div>;
}

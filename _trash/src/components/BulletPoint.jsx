const BulletPoint = ({ icon: Icon, children, className = "" }) => (
  <div className={`flex items-start gap-4 mb-6 ${className}`}>
    {Icon && (
      <div className="flex-shrink-0 w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center">
        <Icon className="w-5 h-5 text-white" />
      </div>
    )}
    <p className="text-xl text-slate-700 leading-relaxed pt-1">{children}</p>
  </div>
);

export default BulletPoint;

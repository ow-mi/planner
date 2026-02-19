const Slide = ({ children, title, number, total }) => (
  <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 p-12 flex flex-col">
    <div className="flex items-center gap-4 mb-8">
      <div className="h-1 w-16 bg-cyan-500"></div>
      <h1 className="text-4xl font-bold text-slate-800">{title}</h1>
    </div>
    <div className="flex-1 flex flex-col justify-center">
      {children}
    </div>
    <div className="flex justify-between items-center mt-8">
      <div className="text-sm text-slate-500">Sensata Technologies</div>
      <div className="text-sm text-slate-500">{number} / {total}</div>
    </div>
  </div>
);

export default Slide;

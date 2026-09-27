import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  Check,
  Tag,
  Users,
  GraduationCap,
  Sparkles,
  Layers,
  FolderPlus,
} from 'lucide-react';
import { Subject, TeacherProfile, Course } from '../types';

export const SUBJECT_CATEGORIES = [
  'Точные науки',
  'Иностранные языки',
  'Естественные науки',
  'IT и технологии',
  'Гуманитарные науки',
  'Детское развитие',
  'Творчество и искусство',
  'Другое',
];

export const SUBJECT_COLOR_OPTIONS: { id: string; name: string; bg: string; text: string; border: string }[] = [
  { id: 'indigo', name: 'Индиго', bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  { id: 'blue', name: 'Синий', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  { id: 'cyan', name: 'Бирюзовый', bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  { id: 'emerald', name: 'Изумрудный', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  { id: 'teal', name: 'Морской', bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  { id: 'amber', name: 'Янтарный', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  { id: 'orange', name: 'Оранжевый', bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  { id: 'rose', name: 'Розовый', bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  { id: 'purple', name: 'Фиолетовый', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  { id: 'violet', name: 'Лиловый', bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
];

export const getSubjectColorStyle = (colorName?: string) => {
  const match = SUBJECT_COLOR_OPTIONS.find((c) => c.id === colorName);
  if (match) return match;
  return SUBJECT_COLOR_OPTIONS[0];
};

interface SubjectManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  teachers: TeacherProfile[];
  courses: Course[];
  onAddSubject: (subject: Subject) => void;
  onUpdateSubject: (subject: Subject) => void;
  onDeleteSubject: (subjectId: string) => void;
  onClearSubjects?: () => void;
}

export const SubjectManagementModal: React.FC<SubjectManagementModalProps> = ({
  isOpen,
  onClose,
  subjects,
  teachers,
  courses,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubject,
  onClearSubjects,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [isEditing, setIsEditing] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState(SUBJECT_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('indigo');

  const resetForm = () => {
    setName('');
    setCode('');
    setCategory(SUBJECT_CATEGORIES[0]);
    setDescription('');
    setColor('indigo');
    setIsEditing(false);
    setEditingSubjectId(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleStartEdit = (subject: Subject) => {
    setName(subject.name);
    setCode(subject.code || '');
    setCategory(subject.category || SUBJECT_CATEGORIES[0]);
    setDescription(subject.description || '');
    setColor(subject.color || 'indigo');
    setEditingSubjectId(subject.id);
    setIsEditing(true);
  };

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Укажите наименование предмета!');
      return;
    }

    if (editingSubjectId) {
      const existing = subjects.find((s) => s.id === editingSubjectId);
      if (existing) {
        onUpdateSubject({
          ...existing,
          name: name.trim(),
          code: code.trim().toUpperCase() || undefined,
          category,
          description: description.trim() || undefined,
          color,
        });
      }
    } else {
      const generatedId = `sub-${Date.now().toString(36)}`;
      const newSub: Subject = {
        id: generatedId,
        name: name.trim(),
        code: code.trim().toUpperCase() || name.slice(0, 4).toUpperCase(),
        category,
        description: description.trim() || undefined,
        color,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      onAddSubject(newSub);
    }

    resetForm();
  };

  const handleDeleteClick = (subject: Subject) => {
    const teachersWithSubject = teachers.filter(
      (t) => t.subjectId === subject.id || t.subject.toLowerCase() === subject.name.toLowerCase()
    );
    const coursesWithSubject = courses.filter(
      (c) => c.subject.toLowerCase() === subject.name.toLowerCase()
    );

    let confirmMsg = `Удалить предмет "${subject.name}" из базы предметов?`;
    if (teachersWithSubject.length > 0 || coursesWithSubject.length > 0) {
      confirmMsg += `\nВнимание: к предмету привязано ${teachersWithSubject.length} преподавателей и ${coursesWithSubject.length} групп.`;
    }

    if (confirm(confirmMsg)) {
      onDeleteSubject(subject.id);
      if (editingSubjectId === subject.id) {
        resetForm();
      }
    }
  };

  const filteredSubjects = subjects.filter((s) => {
    if (selectedCategoryFilter !== 'ALL' && s.category !== selectedCategoryFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = s.name.toLowerCase().includes(q);
      const matchCode = (s.code || '').toLowerCase().includes(q);
      const matchDesc = (s.description || '').toLowerCase().includes(q);
      const matchCat = (s.category || '').toLowerCase().includes(q);
      return matchName || matchCode || matchDesc || matchCat;
    }
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-inner">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
                <span>База Предметов Обучения</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                  {subjects.length} предметов
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Справочник учебных дисциплин для привязки учителей при регистрации и создании курсов
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isEditing && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Добавить предмет</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Add / Edit Form Card */}
          {isEditing && (
            <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-5 space-y-4 relative shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-indigo-400">
                  <FolderPlus className="w-4 h-4" />
                  <span>
                    {editingSubjectId ? 'Редактирование предмета' : 'Создание нового предмета в базе'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Отмена
                </button>
              </div>

              <form onSubmit={handleSaveSubject} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 font-semibold mb-1">
                      Наименование предмета *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Например: Математика, Английский язык, Химия..."
                      className="w-full bg-slate-900 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Код / Аббревиатура
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="Напр: MATH, IELTS, CHEM"
                      maxLength={10}
                      className="w-full bg-slate-900 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Категория предмета
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-900 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    >
                      {SUBJECT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Цветовая метка бейджа
                    </label>
                    <div className="flex items-center space-x-1.5 pt-1">
                      {SUBJECT_COLOR_OPTIONS.map((cOption) => (
                        <button
                          key={cOption.id}
                          type="button"
                          onClick={() => setColor(cOption.id)}
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                            cOption.bg
                          } ${cOption.border} ${
                            color === cOption.id ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                          }`}
                          title={cOption.name}
                        >
                          {color === cOption.id && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Описание и специфика программы (необязательно)
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Например: Подготовка к ДТМ, олимпиадам, школьная программа..."
                    className="w-full bg-slate-900 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold shadow-md shadow-indigo-600/30"
                  >
                    {editingSubjectId ? 'Сохранить изменения' : 'Внести в базу предметов'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по названию, коду или категории предмета..."
                  className="w-full bg-slate-950 text-xs text-white pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-slate-950 text-white text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0"
              >
                <option value="ALL">Все категории</option>
                {SUBJECT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subjects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredSubjects.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 italic bg-slate-950 rounded-2xl border border-slate-800">
                Предметы не найдены. Вы можете добавить новый предмет с помощью кнопки выше.
              </div>
            ) : (
              filteredSubjects.map((subject) => {
                const colorStyle = getSubjectColorStyle(subject.color);
                const assignedTeachers = teachers.filter(
                  (t) => t.subjectId === subject.id || t.subject.toLowerCase().includes(subject.name.toLowerCase())
                );
                const assignedCourses = courses.filter(
                  (c) => c.subject.toLowerCase().includes(subject.name.toLowerCase())
                );

                return (
                  <div
                    key={subject.id}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-4.5 space-y-3 hover:border-slate-700 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border} flex items-center space-x-1`}
                          >
                            <Tag className="w-3 h-3" />
                            <span>{subject.name}</span>
                          </span>
                          {subject.code && (
                            <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                              {subject.code}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(subject)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                            title="Редактировать предмет"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(subject)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
                            title="Удалить предмет"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Category and Description */}
                      <div className="mt-2.5">
                        <p className="text-[11px] font-semibold text-slate-400">
                          Категория:{' '}
                          <span className="text-slate-300 font-medium">{subject.category || 'Общая'}</span>
                        </p>
                        {subject.description && (
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                            {subject.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer Stats: Teachers & Courses */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-slate-300 font-medium">
                          Учителей: {assignedTeachers.length}
                        </span>
                      </span>

                      <span className="flex items-center space-x-1">
                        <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-slate-300 font-medium">
                          Групп: {assignedCourses.length}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center space-x-3">
            <span>Всего в базе: {subjects.length} дисциплин</span>
            {onClearSubjects && subjects.length > 0 && (
              <button
                type="button"
                onClick={onClearSubjects}
                className="text-rose-400 hover:text-rose-300 hover:underline text-[11px] font-semibold flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Очистить базу предметов</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
          >
            Закрыть справочник
          </button>
        </div>

      </div>
    </div>
  );
};

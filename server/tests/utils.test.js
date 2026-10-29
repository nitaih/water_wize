// בדיקת יחידה לדוגמה לפונקציית עיבוד נתונים או חישוב כלשהו
const formatPipelineData = (pipeline) => {
  if (!pipeline) return null;
  return {
    id: pipeline.id,
    nameFormatted: `Pipeline - ${pipeline.id}`
  };
};

describe('Unit Tests - Pipeline Helpers', () => {
  it('should format pipeline data correctly', () => {
    const mockPipeline = { id: 10, type: 'Water' };
    const result = formatPipelineData(mockPipeline);

    expect(result).toEqual({
      id: 10,
      nameFormatted: 'Pipeline - 10'
    });
  });

  it('should return null if no pipeline is provided', () => {
    const result = formatPipelineData(null);
    expect(result).toBeNull();
  });
});

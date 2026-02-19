// Test to reproduce the leg parsing bug

// Simulate parseCompositeLeg from configEditorComponent.js
const parseCompositeLeg = (rawLeg) => {
    const value = String(rawLeg || '').trim();
    if (!value || !value.includes('__')) {
        return { project: '', leg: value, branch: '' };
    }
    const parts = value.split('__');
    if (parts.length === 2) {
        return { project: parts[0] || '', leg: parts[1] || '', branch: '' };
    }
    return {
        project: parts[0] || '',
        leg: parts[1] || '',
        branch: parts.slice(2).join('__') || ''
    };
};

// Test cases
const testCases = [
    'projectA__leg1__main',
    'projectA__leg1__a',
    'projectA__leg1__b',
    'projectA__leg1',
    'leg1',
    '__leg1__main',  // Edge case: empty project
    'projectA____main'  // Edge case: empty leg
];

console.log('Testing parseCompositeLeg function:');
console.log('=====================================');
testCases.forEach(input => {
    const result = parseCompositeLeg(input);
    console.log(`Input: "${input}"`);
    console.log(`  project: "${result.project}", leg: "${result.leg}", branch: "${result.branch}"`);
    console.log('');
});

// Simulate the CSV extraction logic
console.log('\nSimulating CSV extraction:');
console.log('==========================');

// Simulated CSV row: [project_col, leg_col, branch_col]
// Case 1: Composite in leg column, no separate project/branch columns
const csvRow1 = { leg: 'projectA__leg1__main' };
const csvProject1 = '';
const csvLegValue1 = csvRow1.leg;
const csvBranch1 = '';
const parsedComposite1 = parseCompositeLeg(csvLegValue1);
const project1 = csvProject1 || parsedComposite1.project || '';
const leg1 = parsedComposite1.leg || csvLegValue1 || '';
const branch1 = csvBranch1 || parsedComposite1.branch || '';

console.log('Case 1: Composite in leg column only');
console.log(`  CSV leg value: "${csvLegValue1}"`);
console.log(`  Extracted: project="${project1}", leg="${leg1}", branch="${branch1}"`);

// Case 2: Separate columns
const csvRow2 = { project: 'projectA', leg: 'leg1', branch: 'main' };
const csvProject2 = csvRow2.project;
const csvLegValue2 = csvRow2.leg;
const csvBranch2 = csvRow2.branch;
const parsedComposite2 = parseCompositeLeg(csvLegValue2);
const project2 = csvProject2 || parsedComposite2.project || '';
const leg2 = parsedComposite2.leg || csvLegValue2 || '';
const branch2 = csvBranch2 || parsedComposite2.branch || '';

console.log('\nCase 2: Separate columns');
console.log(`  CSV values: project="${csvProject2}", leg="${csvLegValue2}", branch="${csvBranch2}"`);
console.log(`  Extracted: project="${project2}", leg="${leg2}", branch="${branch2}"`);

// Case 3: Composite in leg column but explicit project column
const csvRow3 = { project: 'projectB', leg: 'projectA__leg1__main' };
const csvProject3 = csvRow3.project;
const csvLegValue3 = csvRow3.leg;
const csvBranch3 = '';
const parsedComposite3 = parseCompositeLeg(csvLegValue3);
const project3 = csvProject3 || parsedComposite3.project || '';
const leg3 = parsedComposite3.leg || csvLegValue3 || '';
const branch3 = csvBranch3 || parsedComposite3.branch || '';

console.log('\nCase 3: Composite in leg + explicit project column (projectB wins)');
console.log(`  CSV values: project="${csvProject3}", leg="${csvLegValue3}"`);
console.log(`  Extracted: project="${project3}", leg="${leg3}", branch="${branch3}"`);

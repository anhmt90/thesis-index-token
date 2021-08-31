

export const float2TokenUnits = (num, decimals = 18) => {
    let [integral, fractional] = String(num).split('.');
    if (fractional === undefined) {
        return integral + '0'.repeat(decimals);
    }
    fractional = fractional + '0'.repeat(decimals - fractional.length);
    return integral !== '0' ? integral + fractional : fractional;
};

export const tokenUnits2Float = (num, decimals = 18) => {
    if(typeof decimals === 'string') {
        decimals = parseInt(decimals)
    }
    if(num.length > decimals) {
        return num.slice(0, num.length - decimals) + '.' + num.slice(num.length - decimals)
    } else {
        return '0.' + '0'.repeat(decimals - num.length) + num
    }
}
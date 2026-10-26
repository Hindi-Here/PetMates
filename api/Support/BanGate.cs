using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace api.Support
{
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class AllowBannedAttribute : Attribute { }

    public sealed class BanGateFilter(SupportManager sup) : IAsyncActionFilter
    {
        public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
        {
            var allowed = ctx.ActionDescriptor.EndpointMetadata.OfType<AllowBannedAttribute>().Any();
            if (!allowed)
            {
                var header = ctx.HttpContext.Request.Headers.Authorization.ToString();
                var id = await sup.GetUserIdAsync(header);
                if (!string.IsNullOrEmpty(id) && (await sup.GetAccessAsync(id)).IsBanned)
                {
                    ctx.Result = new ObjectResult(new { message = "Аккаунт заблокирован", isBanned = true }) { StatusCode = 403 };
                    return;
                }
            }
            await next();
        }
    }
}